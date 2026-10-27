import React, {useEffect, useMemo, useRef, useState} from 'react';
import {throttle} from "lodash";

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

// Auto-fill: width of the progressively blurred strip next to the image edge (beyond it the last column repeats)
const FILL_DEPTH = 160;
const FILL_MAX_BLUR = 48;   // Vertical blur radius reached at FILL_DEPTH px from the edge
const FILL_EDGE_COLUMNS = 3; // Edge columns averaged together, so one noisy pixel column doesn't streak
const FILL_SEAM_OVERLAP = 2; // px of fill drawn under the image edge, so the seam is always fully covered

/**
 * Builds the auto-fill strip for one side of the image: the edge pixels stretched outwards, blurred vertically
 * more and more the further they are from the image. Built at the scaled image size, so slices can copy from it
 * with the same y as the image.
 *
 * @param img Original image
 * @param width Scaled image width
 * @param height Scaled image height
 * @param side 'left' or 'right'
 * @return {HTMLCanvasElement} FILL_DEPTH x height canvas; the edge touching the image is on the image side
 */
const buildEdgeFill = (img, width, height, side) => {
    const scale = width / img.naturalWidth;
    const sourceWidth = FILL_EDGE_COLUMNS / scale;

    const edge = document.createElement('canvas');
    edge.width = FILL_EDGE_COLUMNS;
    edge.height = height;
    const edgeCtx = edge.getContext('2d');
    edgeCtx.imageSmoothingQuality = 'high';
    edgeCtx.drawImage(
        img,
        side === 'left' ? 0 : img.naturalWidth - sourceWidth, 0, sourceWidth, img.naturalHeight,
        0, 0, FILL_EDGE_COLUMNS, height
    );
    const px = edgeCtx.getImageData(0, 0, FILL_EDGE_COLUMNS, height).data;

    // Prefix sums of alpha-weighted colors per row, so any vertical blur radius costs O(1) per pixel
    const sumR = new Float64Array(height + 1), sumG = new Float64Array(height + 1);
    const sumB = new Float64Array(height + 1), sumA = new Float64Array(height + 1);
    for (let y = 0; y < height; y++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = 0; k < FILL_EDGE_COLUMNS; k++) {
            const i = (y * FILL_EDGE_COLUMNS + k) * 4;
            const alpha = px[i + 3];
            r += px[i] * alpha;
            g += px[i + 1] * alpha;
            b += px[i + 2] * alpha;
            a += alpha;
        }
        sumR[y + 1] = sumR[y] + r;
        sumG[y + 1] = sumG[y] + g;
        sumB[y + 1] = sumB[y] + b;
        sumA[y + 1] = sumA[y] + a;
    }

    const fill = document.createElement('canvas');
    fill.width = FILL_DEPTH;
    fill.height = height;
    const fillCtx = fill.getContext('2d');
    const out = fillCtx.createImageData(FILL_DEPTH, height);

    for (let d = 0; d < FILL_DEPTH; d++) {
        const radius = Math.round(FILL_MAX_BLUR * d / (FILL_DEPTH - 1));
        const x = side === 'left' ? FILL_DEPTH - 1 - d : d;
        for (let y = 0; y < height; y++) {
            const lo = Math.max(0, y - radius);
            const hi = Math.min(height - 1, y + radius);
            const a = sumA[hi + 1] - sumA[lo];
            const i = (y * FILL_DEPTH + x) * 4;
            if (a > 0) {
                out.data[i] = (sumR[hi + 1] - sumR[lo]) / a;
                out.data[i + 1] = (sumG[hi + 1] - sumG[lo]) / a;
                out.data[i + 2] = (sumB[hi + 1] - sumB[lo]) / a;
                out.data[i + 3] = a / ((hi - lo + 1) * FILL_EDGE_COLUMNS);
            }
        }
    }
    fillCtx.putImageData(out, 0, 0);
    return fill;
}

/**
 * Draws the auto-fill into the empty space left or right of the image in one slice.
 *
 * @param ctx Slice canvas context
 * @param fill {left, right} strips from buildEdgeFill
 * @param imageWidth Scaled image width
 * @param x Horizontal position of the slice (in scaled px)
 * @param y Vertical position of the slice (in scaled px)
 * @param height Height of the region (in scaled px)
 * @param channelHeight Output height of the image
 */
const drawEdgeFill = (ctx, fill, imageWidth, x, y, height, channelHeight) => {
    // Empty space on the left: the image starts at output x = -x
    if (x < 0) {
        const imageStart = -x;
        const near = Math.min(imageStart, FILL_DEPTH);
        const farEnd = imageStart - near;
        if (farEnd > 0) {
            // Drawn first and a bit wider, so it also sits under the strip's partly covered first column
            ctx.drawImage(fill.left, 0, y, 1, height, 0, 0, Math.ceil(farEnd) + FILL_SEAM_OVERLAP, channelHeight);
        }
        ctx.drawImage(fill.left, FILL_DEPTH - near, y, near, height, farEnd, 0, near, channelHeight);
        // Slide the edge color under the image's first pixels: when the edge falls between two pixels, fill and
        // image would each only partly cover that column and leave a faint dark line
        ctx.drawImage(fill.left, FILL_DEPTH - 1, y, 1, height, Math.floor(imageStart), 0, FILL_SEAM_OVERLAP, channelHeight);
    }

    // Empty space on the right: the image ends at output x = imageWidth - x
    const imageEnd = imageWidth - x;
    if (imageEnd < CHANNEL_BANNER_WIDTH) {
        const farStart = imageEnd + FILL_DEPTH;
        if (farStart < CHANNEL_BANNER_WIDTH) {
            const from = Math.floor(farStart) - FILL_SEAM_OVERLAP;
            ctx.drawImage(fill.right, FILL_DEPTH - 1, y, 1, height, from, 0, CHANNEL_BANNER_WIDTH - from, channelHeight);
        }
        ctx.drawImage(fill.right, 0, y, FILL_DEPTH, height, imageEnd, 0, FILL_DEPTH, channelHeight);
        ctx.drawImage(fill.right, 0, y, 1, height, Math.ceil(imageEnd) - FILL_SEAM_OVERLAP, 0, FILL_SEAM_OVERLAP, channelHeight);
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
 * @param fill Auto-fill strips ({left, right}) or null when auto-fill is off
 * @param imageWidth Scaled image width
 * @return {string} Base64 encoded image (DataURL)
 */

const getClippedRegion = (canvas, img, scale, x, y, height, channelHeight, color, fill, imageWidth) => {
    canvas.width = CHANNEL_BANNER_WIDTH;
    canvas.height = channelHeight;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, CHANNEL_BANNER_WIDTH, channelHeight);

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CHANNEL_BANNER_WIDTH, channelHeight);

    ctx.imageSmoothingQuality = 'high';
    if (fill) drawEdgeFill(ctx, fill, imageWidth, x, y, height, channelHeight);
    ctx.drawImage(
        img,
        x / scale, y / scale, CHANNEL_BANNER_WIDTH / scale, height / scale,
        0, 0, CHANNEL_BANNER_WIDTH, channelHeight
    );

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
 * @param fill Auto-fill strips ({left, right}) or null
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
            fill,
            inputFile.width)
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

const ImageManipulation = ({children}) => {
    const [sourceImage, setSourceImage] = useState(initialValue.sourceImage);
    const [rooms, setRooms] = useState(initialValue.rooms);
    const [results, setResults] = useState(initialValue.results);
    const [options, setOptions] = useState(initialValue.options);
    const [exportStatus, setExportStatus] = useState(initialValue.exportStatus);
    const [imageObject, setImageObject] = useState();
    const lastSourceImage = useRef(null);

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

    // Auto-fill strips only depend on the image and its scaled size, so moving the offsets doesn't rebuild them
    const fill = useMemo(() => {
        if (!options.autoFill || imageObject == null || sourceImage.data == null) return null;
        return {
            left: buildEdgeFill(imageObject, image.width, image.height, 'left'),
            right: buildEdgeFill(imageObject, image.width, image.height, 'right'),
        };
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
        setRooms
    }

    return (
        <ImageManipulationContext.Provider value={value}>
            {children}
        </ImageManipulationContext.Provider>
    );
}


export default ImageManipulation;