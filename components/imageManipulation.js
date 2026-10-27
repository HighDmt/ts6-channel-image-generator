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
 * @return {string} Base64 encoded image (DataURL)
 */

const getClippedRegion = (canvas, img, scale, x, y, height, channelHeight, color) => {
    canvas.width = CHANNEL_BANNER_WIDTH;
    canvas.height = channelHeight;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, CHANNEL_BANNER_WIDTH, channelHeight);

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, CHANNEL_BANNER_WIDTH, channelHeight);

    ctx.imageSmoothingQuality = 'high';
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
 * @param cb
 */
const generateImages = (inputFile, options, canvas, image, rooms, cb) => {
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
            options.backgroundColor)
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

                debouncedGenerateImage(image, options, canvas, imageObject, rooms, (results) => {
                    setResults(results);
                    const end = Date.now();
                    setExportStatus((c) => ({...c, end: end, delta: end - start}));
                });
            }
        )();
    }, [imageObject, options, image, rooms])

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