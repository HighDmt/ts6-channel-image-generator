import React, {useEffect, useMemo, useRef, useState} from 'react';
import {debounce, throttle} from "lodash";
import {clearItems, loadItem, saveItem} from "./storage";

// TeamSpeak 6 geometry, measured on a real TS6 client (see docs/ and CLAUDE.md section 4).
// Every row (channel or spacer) is 30 px tall with a 14 px gap, so the row pitch is 44 px.
// TS6 draws the banner 1:1, vertically centered in the row, so a 44 px slice shows its middle 30 px.
export const SPACER_HEIGHT = 30;
export const SPACER_BANNER_HEIGHT = 44;
export const CHANNEL_HEIGHT = 30;
export const CHANNEL_BANNER_HEIGHT = 44;
export const CHANNEL_GAP = CHANNEL_BANNER_HEIGHT - CHANNEL_HEIGHT;
export const CHANNEL_BANNER_WIDTH = 500;
export const CHANNEL_DEPTH_OFFSET = 10;     // Row indent per nesting level (preview only)
export const IMAGE_LEFT_HIDDEN = 10;        // Image x hidden at depth 0 (+ CHANNEL_DEPTH_OFFSET per level)

export const defaultRoom = {depth: 0, spacer: false};

const initialValue = {
    options: {
        slices: 1,
        yOffset: 0,
        xOffset: 0,
        ignoreSpacing: false,
        zoom: 100, // % of the 500 px banner width the image is scaled to
        autoFill: false, // Fill empty space beside the image with its stretched, blurred edges
        backgroundColor: '#00000000',
    },
    results: [null, null, null, null, null],  // By default show 5 rooms without image
    rooms: new Array(256).fill(defaultRoom), // TODO: This creates arbitrary limit of maximum image size to 256 slices
    sourceImage: {
        data: null,
        name: null,
        height: 30,
        width: 100
    },
    image: {
        data: null,
        name: null,
        height: 30,
        width: 100
    },
    exportStatus: {
        start: null,
        end: null,
        delta: null
    }
}

export const ImageManipulationContext = React.createContext(initialValue);

/**
 * Returns height of the channel based on channel type and options
 *
 * @param isSpacer
 * @param ignoreSpacing
 * @return {number}
 */
const getChannelHeight = (isSpacer, ignoreSpacing) => isSpacer
    ? ignoreSpacing ? SPACER_HEIGHT : SPACER_BANNER_HEIGHT
    : ignoreSpacing ? CHANNEL_HEIGHT : CHANNEL_BANNER_HEIGHT

/**
 * Creates HTML canvas of given size
 *
 * @return {HTMLCanvasElement}
 */
const getCanvas = () => {
    if (typeof document === "undefined") return;

    const canvas = document.createElement('canvas')

    canvas.width = 0;
    canvas.height = 0;

    return canvas;
}

/**
 * Creates new image object and loads the image provided by url
 *
 * @param url Url to the image (can ba base64 data url)
 * @return {Promise<unknown>}
 */
const getImage = async (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.crossOrigin = "Anonymous" // Needed so images loaded from a URL can be read back from the canvas
        img.onerror = reject
        img.onload = () => {
            resolve(img)
        }
        img.src = url;
    })
}

// Auto-fill: the image is surrounded by a FILL_DEPTH px border where its edge is stretched outwards and blurred more
// and more with distance; beyond that border the outermost (most blurred) line is stretched.
const FILL_DEPTH = 160;
const FILL_MAX_BLUR = 48;    // Blur radius (along the edge) reached at FILL_DEPTH px from the image
const FILL_EDGE_LINES = 3;   // Edge lines averaged together, so one noisy pixel line doesn't streak
const FILL_SEAM_OVERLAP = 2; // px the stretched parts are drawn under their neighbours, so seams are always covered

/**
 * Blurs the averaged edge lines along the edge, with a radius growing with the distance d from the image.
 *
 * @param data RGBA data holding the edge lines
 * @param length Length of the edge (px)
 * @param lines Number of edge lines in data
 * @param index (k, i) => byte offset of pixel i of edge line k (k = 0 is the outermost line)
 * @return {Uint8ClampedArray} RGBA, pixel i at distance d is at [(d * length + i) * 4]
 */
const blurredStrip = (data, length, lines, index) => {
    // Prefix sums of alpha-weighted colors along the edge, so any blur radius costs O(1) per pixel
    const sumR = new Float64Array(length + 1), sumG = new Float64Array(length + 1);
    const sumB = new Float64Array(length + 1), sumA = new Float64Array(length + 1);
    for (let i = 0; i < length; i++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = 0; k < lines; k++) {
            const o = index(k, i);
            const alpha = data[o + 3];
            r += data[o] * alpha;
            g += data[o + 1] * alpha;
            b += data[o + 2] * alpha;
            a += alpha;
        }
        sumR[i + 1] = sumR[i] + r;
        sumG[i + 1] = sumG[i] + g;
        sumB[i + 1] = sumB[i] + b;
        sumA[i + 1] = sumA[i] + a;
    }

    const out = new Uint8ClampedArray(FILL_DEPTH * length * 4);
    for (let d = 0; d < FILL_DEPTH; d++) {
        const radius = Math.round(FILL_MAX_BLUR * d / (FILL_DEPTH - 1));
        for (let i = 0; i < length; i++) {
            const lo = Math.max(0, i - radius);
            const hi = Math.min(length - 1, i + radius);
            const a = sumA[hi + 1] - sumA[lo];
            if (a > 0) {
                const o = (d * length + i) * 4;
                out[o] = (sumR[hi + 1] - sumR[lo]) / a;
                out[o + 1] = (sumG[hi + 1] - sumG[lo]) / a;
                out[o + 2] = (sumB[hi + 1] - sumB[lo]) / a;
                out[o + 3] = a / ((hi - lo + 1) * lines);
            }
        }
    }
    return out;
}

/**
 * Returns a copy of src with a FILL_DEPTH px auto-fill border added on both sides of one axis.
 *
 * @param src Canvas
 * @param horizontal true: border left and right; false: top and bottom
 * @return {HTMLCanvasElement}
 */
const extendCanvas = (src, horizontal) => {
    const w = src.width, h = src.height;
    const srcCtx = src.getContext('2d');
    const length = horizontal ? h : w;
    const lines = Math.min(FILL_EDGE_LINES, horizontal ? w : h);

    // Edge lines on both sides, read as (lines x h) columns or (w x lines) rows
    const nearData = horizontal ? srcCtx.getImageData(0, 0, lines, h).data : srcCtx.getImageData(0, 0, w, lines).data;
    const farData = horizontal ? srcCtx.getImageData(w - lines, 0, lines, h).data : srcCtx.getImageData(0, h - lines, w, lines).data;
    const near = blurredStrip(nearData, length, lines, horizontal
        ? (k, i) => (i * lines + k) * 4
        : (k, i) => (k * w + i) * 4);
    const far = blurredStrip(farData, length, lines, horizontal
        ? (k, i) => (i * lines + lines - 1 - k) * 4
        : (k, i) => ((lines - 1 - k) * w + i) * 4);

    const out = document.createElement('canvas');
    out.width = horizontal ? w + 2 * FILL_DEPTH : w;
    out.height = horizontal ? h : h + 2 * FILL_DEPTH;
    const ctx = out.getContext('2d');
    ctx.drawImage(src, horizontal ? FILL_DEPTH : 0, horizontal ? 0 : FILL_DEPTH);

    const stripWidth = horizontal ? FILL_DEPTH : w;
    const stripHeight = horizontal ? h : FILL_DEPTH;
    const putStrip = (strip, before) => {
        const img = ctx.createImageData(stripWidth, stripHeight);
        for (let d = 0; d < FILL_DEPTH; d++) {
            const s = before ? FILL_DEPTH - 1 - d : d; // Position across the strip; d = 0 touches the image
            for (let i = 0; i < length; i++) {
                const from = (d * length + i) * 4;
                const to = (horizontal ? i * stripWidth + s : s * stripWidth + i) * 4;
                img.data[to] = strip[from];
                img.data[to + 1] = strip[from + 1];
                img.data[to + 2] = strip[from + 2];
                img.data[to + 3] = strip[from + 3];
            }
        }
        const offset = before ? 0 : (horizontal ? w : h) + FILL_DEPTH;
        ctx.putImageData(img, horizontal ? offset : 0, horizontal ? 0 : offset);
    };
    putStrip(near, true);
    putStrip(far, false);
    return out;
}

/**
 * Builds the auto-fill canvas: the image at its scaled size with a FILL_DEPTH px border on every side. Left/right
 * are added first, so the top/bottom pass also extends them into the corners.
 *
 * @param img Original image
 * @param width Scaled image width
 * @param height Scaled image height
 * @return {HTMLCanvasElement} (width + 2 * FILL_DEPTH) x (height + 2 * FILL_DEPTH)
 */
const buildFill = (img, width, height) => {
    const base = document.createElement('canvas');
    base.width = width;
    base.height = height;
    const ctx = base.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    return extendCanvas(extendCanvas(base, true), false);
}

/**
 * Splits a slice range along one axis into the parts before, inside and after the fill canvas.
 * Parts outside copy the fill's outermost line, stretched.
 */
const axisParts = (start, size, total) => {
    const end = start + size;
    const parts = [];
    if (start < 0) parts.push({from: start, to: Math.min(end, 0), src: 0, srcSize: 1, outer: true});
    if (end > 0 && start < total) {
        const from = Math.max(start, 0), to = Math.min(end, total);
        parts.push({from, to, src: from, srcSize: to - from, outer: false});
    }
    if (end > total) parts.push({from: Math.max(start, total), to: end, src: total - 1, srcSize: 1, outer: true});
    return parts;
}

/**
 * Draws one slice from the auto-fill canvas, stretching its outermost lines where the slice goes beyond it.
 * Stretched parts are drawn first (corners, then sides) and a little bigger, so the parts drawn on top never leave a
 * partly covered pixel line (a faint dark seam) when an edge falls between two pixels.
 *
 * @param ctx Slice canvas context
 * @param fill Canvas from buildFill
 * @param x Horizontal position of the slice in the scaled image
 * @param y Vertical position of the slice in the scaled image
 * @param height Height of the slice
 */
const drawFilled = (ctx, fill, x, y, height) => {
    const sx = x + FILL_DEPTH, sy = y + FILL_DEPTH;
    const cells = [];
    for (const px of axisParts(sx, CHANNEL_BANNER_WIDTH, fill.width)) {
        for (const py of axisParts(sy, height, fill.height)) {
            cells.push({px, py, outer: px.outer + py.outer});
        }
    }
    cells.sort((a, b) => b.outer - a.outer);
    for (const {px, py} of cells) {
        const growX = px.outer ? FILL_SEAM_OVERLAP : 0;
        const growY = py.outer ? FILL_SEAM_OVERLAP : 0;
        ctx.drawImage(
            fill,
            px.src, py.src, px.srcSize, py.srcSize,
            px.from - sx - growX, py.from - sy - growY, px.to - px.from + 2 * growX, py.to - py.from + 2 * growY
        );
    }
}

/**
 * Renders image on canvas in given position and returns base64 encoded image of the visible area.
 *
 * @param canvas Canvas to render image on
 * @param img Image Object that will be rendered (original, full size)
 * @param scale Scale of the original image (scaled px per original px)
 * @param x Horizontal position (in scaled px)
 * @param y Vertical position (in scaled px)
 * @param height Height of the region (in scaled px)
 * @param channelHeight Output height of the image
 * @param color Background color of the canvas (visible when drawing dransparent images)
 * @param fill Auto-fill canvas from buildFill, or null when auto-fill is off
 * @return {string} Base64 encoded image (DataURL)
 */

const getClippedRegion = (canvas, img, scale, x, y, height, channelHeight, color, fill) => {
    canvas.width = CHANNEL_BANNER_WIDTH;
    canvas.height = channelHeight;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, CHANNEL_BANNER_WIDTH, channelHeight);

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CHANNEL_BANNER_WIDTH, channelHeight);

    ctx.imageSmoothingQuality = 'high';
    if (fill) {
        drawFilled(ctx, fill, x, y, height);
    } else {
        ctx.drawImage(
            img,
            x / scale, y / scale, CHANNEL_BANNER_WIDTH / scale, height / scale,
            0, 0, CHANNEL_BANNER_WIDTH, channelHeight
        );
    }

    return canvas.toDataURL();
};

/**
 * Returns maximum amount of slices that image can be sliced to
 *
 * @param width Width of the source image
 * @param height height of the source image
 * @param rooms Array of room objects
 * @param ignoreSpacing If true calculation will ignore channel spacing
 * @return {number} Number of slices
 */
export const getSlicesCount = (width, height, rooms, ignoreSpacing) => {
    let count = 0;

    // Slices are cut 1:1 from the resized image, whatever its width (zoom)
    let remainingHeight = height;

    for (const room of rooms) {
        const channelHeight = getChannelHeight(room.spacer, ignoreSpacing);
        if (remainingHeight - channelHeight < 0) break;
        remainingHeight -= channelHeight;
        count++;
    }

    return count;
}

/**
 * Returns total height of the all channels
 *
 * @param width Width of the source image
 * @param height height of the source image
 * @param rooms Array of room objects
 * @param ignoreSpacing If true calculation will ignore channel spacing
 * @param channelsCount Maximum count of the channels (needed to prevent counting placeholder channels)
 * @return {*}
 */
export const getRoomsHeight = (width, height, rooms, ignoreSpacing, channelsCount) => {
    const slicesCount = getSlicesCount(width, height, rooms, ignoreSpacing);
    return rooms.reduce((acc, room, i) => {
        if (i > slicesCount - 1) return acc;
        if (channelsCount != null && i >= channelsCount) return acc;
        return acc + getChannelHeight(room.spacer, ignoreSpacing);
    }, 0);
}

/**
 * Generates slices of the inputFile image based on the given options
 *
 * @param inputFile Input file object containing base64URL encoded image data and image metadata (width, height, name)
 * @param options Options object providing values like number of output slices, height of the slice and vertical offset
 * @param canvas Canvas Object to be used for image rendering
 * @param image Reference to image object that contains image to render
 * @param rooms Reference to rooms data from preview
 * @param fill Auto-fill canvas or null
 * @param cb
 */
const generateImages = (inputFile, options, canvas, image, rooms, fill, cb) => {
    const result = [];
    const scale = inputFile.width / image.naturalWidth;
    let y = 0;
    for (let i = 0; i < options.slices; i++) {
        const room = rooms[i];

        const channelHeight = getChannelHeight(room.spacer, options.ignoreSpacing);

        // TS6 anchors the image in screen space, not per row, so nested rows need no x shift
        result.push(getClippedRegion(
            canvas, image, scale,
            -options.xOffset, options.yOffset + y,
            channelHeight,
            channelHeight,
            options.backgroundColor,
            fill)
        )

        y += channelHeight;
    }
    cb(result);
}


// Throttle time of the generateImage function. Should be approximately same as average time that it takes process average image.
const THROTTLE_TIME = 50;

/**
 * Throttled (Using lodash throttle) generateImage function that is used to prevent generating unnecessarily to many
 * images when changing options using UI
 *
 * @type {DebouncedFunc<generateImages>}
 */
const debouncedGenerateImage = throttle(generateImages, THROTTLE_TIME);

// Settings are saved shortly after the sliders stop moving, not on every step
const debouncedSaveSettings = debounce((settings) => saveItem('settings', settings), 500);

const ImageManipulation = ({children}) => {
    const [sourceImage, setSourceImage] = useState(initialValue.sourceImage);
    const [rooms, setRooms] = useState(initialValue.rooms);
    const [results, setResults] = useState(initialValue.results);
    const [options, setOptions] = useState(initialValue.options);
    const [exportStatus, setExportStatus] = useState(initialValue.exportStatus);
    const [imageObject, setImageObject] = useState();
    const lastSourceImage = useRef(null);
    const [restored, setRestored] = useState(false); // Nothing is saved until the saved project is loaded back

    const [canvas, _] = useState(getCanvas())

    // Size of the image after scaling. TS6 scales anything wider than 500 px down, so slices are always cut
    // 500 px wide; zoom only changes how big the image is before it is cut. Slices are drawn straight from the
    // original image at this scale, so moving the zoom slider is as fast as moving the offsets.
    const image = useMemo(() => {
        if (sourceImage.data == null) return initialValue.image;
        const width = Math.round(CHANNEL_BANNER_WIDTH * options.zoom / 100);
        return {
            data: sourceImage.data,
            width,
            height: Math.round(sourceImage.height * width / sourceImage.width),
            name: sourceImage.name
        };
    }, [sourceImage, options.zoom]);

    // The auto-fill canvas only depends on the image and its scaled size, so moving the offsets doesn't rebuild it
    const fill = useMemo(() => {
        if (!options.autoFill || imageObject == null || sourceImage.data == null) return null;
        return buildFill(imageObject, image.width, image.height);
    }, [options.autoFill, imageObject, image.width, image.height]);

    // When source image is changed loads new imageObject into canvas
    useEffect(() => {
        (async () => {
                if (sourceImage.data == null) return;
                const start = Date.now();
                setExportStatus((c) => ({...c, start: start, end: null}));
                setImageObject(null);
                setImageObject(await getImage(sourceImage.data));
                const end = Date.now();
                setExportStatus((c) => ({...c, end: end, delta: end - start}));
            }
        )();
    }, [sourceImage])

    // When inputFile or options are changed it generates new result images
    useEffect(() => {
        (async () => {
                if (imageObject == null) return;

                const start = Date.now();
                setExportStatus((c) => ({...c, start: start, end: null}));

                debouncedGenerateImage(image, options, canvas, imageObject, rooms, fill, (results) => {
                    setResults(results);
                    const end = Date.now();
                    setExportStatus((c) => ({...c, end: end, delta: end - start}));
                });
            }
        )();
    }, [imageObject, options, image, rooms, fill])

    // Loads the project saved in this browser, if any
    useEffect(() => {
        (async () => {
            const [savedImage, settings] = await Promise.all([loadItem('image'), loadItem('settings')]);
            if (settings?.rooms) {
                setRooms(initialValue.rooms.map((room, i) => settings.rooms[i] ?? room));
            }
            if (savedImage?.data) {
                lastSourceImage.current = savedImage; // Keep the saved offsets instead of resetting them below
                setSourceImage(savedImage);
                setOptions({...initialValue.options, ...settings?.options});
            }
            setRestored(true);
        })();
    }, []);

    useEffect(() => {
        if (restored && sourceImage.data != null) saveItem('image', sourceImage);
    }, [restored, sourceImage]);

    useEffect(() => {
        if (restored) debouncedSaveSettings({options, rooms});
    }, [restored, options, rooms]);

    const resetProject = () => {
        debouncedSaveSettings.cancel();
        clearItems();
        setSourceImage(initialValue.sourceImage);
        setImageObject(null);
        setOptions(initialValue.options);
        setRooms(initialValue.rooms);
        setResults(initialValue.results);
    };

    // When input file is changed it recalculates maxSlicesCount and resets yOffset option
    useEffect(() => {
        if (lastSourceImage.current === sourceImage) return;
        const slices = getSlicesCount(image.width, image.height, rooms, options.ignoreSpacing);
        setOptions((o) => ({...o, slices, yOffset: 0, xOffset: 0}))
        lastSourceImage.current = sourceImage;
    }, [image])

    const value = {
        results,
        options,
        setOptions,
        image,
        exportStatus,
        setExportStatus,
        sourceImage,
        setSourceImage,
        rooms,
        setRooms,
        resetProject
    }

    return (
        <ImageManipulationContext.Provider value={value}>
            {children}
        </ImageManipulationContext.Provider>
    );
}


export default ImageManipulation;