import React, {useContext, useEffect, useState} from 'react';
import Step from "./step";
import {ImageManipulationContext} from "./imageManipulation";
import {Button, Code, FormGroup, InputGroup, ProgressBar} from "@blueprintjs/core";
import * as JSZip from "jszip";
import {saveAs} from "file-saver";
import {toaster} from "../pages";

const Export = () => {
    const {previewStatus, results, sourceImage} = useContext(ImageManipulationContext);
    const [fileNamePrefix, setFileNamePrefix] = useState('');
    // 'idle' → 'exporting' → 'done' | 'failed'. progress drives the bar, ms = how long the last export took.
    const [exportStatus, setExportStatus] = useState({state: 'idle', progress: 0, ms: null});
    const setProgress = (progress) => setExportStatus((s) => ({...s, progress}));

    const isGeneratingPreview = previewStatus.state === 'rendering';
    const isExporting = exportStatus.state === 'exporting';

    const previewFailed = previewStatus.state === 'failed';
    const previewTimeDeltaStr = previewStatus.ms == null ? 'N/A' : `${previewStatus.ms}ms`;
    const exportTimeDeltaStr = exportStatus.ms == null ? 'N/A' : `${exportStatus.ms}ms`;

    const disabled = sourceImage.data == null;

    // New results make the last export outdated (but don't interrupt one that is running)
    useEffect(() => {
        setExportStatus((s) => s.state === 'exporting' ? s : {...s, state: 'idle', progress: 0});
    }, [results])

    /**
     * Creates ZIP file with result images in /images folder and /files.txt file that contains names of all images in
     * images folder. If file name prefix is specified images are prefixed with it (`prefix_%d.png`) otherwise
     * `%d.png` file name is used.
     *
     * @return {Promise<void>}
     */
    const exportToZip = async () => {
        const start = Date.now();
        setExportStatus((s) => ({...s, state: 'exporting', progress: 0.1}));
        try {
            const zip = new JSZip();
            let filesTxt = '';

            const imagesFolder = zip.folder("images");

            results.forEach((result, i) => {
                const base64Data = result.replace(/^data:image\/(png|jpg);base64,/, "");

                const fileName = `${fileNamePrefix}${fileNamePrefix.length > 0 ? '_' : ''}${i}.png`;

                imagesFolder.file(fileName, base64Data, {base64: true});
                filesTxt += `${fileName}\n`;
            })

            setProgress(0.5);

            zip.file("files.txt", filesTxt);

            const blob = await zip.generateAsync({type: "blob"})

            setProgress(0.8);

            saveAs(blob, `ts6_channel_banner_${sourceImage.name}.zip`)

            setExportStatus({state: 'done', progress: 1, ms: Date.now() - start});
        } catch (e) {
            console.error(e);
            setExportStatus((s) => ({...s, state: 'failed', progress: 1}));
            toaster.show({intent: "danger", message: "Export failed, please try again.", icon: "error"});
        }
    }

    return (
        <Step number={3}>
            <FormGroup
                label="Generating preview"
                labelInfo={"(Status of preview you see on the right)"}
                helperText={previewFailed ? 'This image could not be read, please pick another one.'
                    : <>Last preview render time: <b>{previewTimeDeltaStr}</b></>}
                disabled={disabled}
            >
                <ProgressBar
                    value={disabled ? 0 : !isGeneratingPreview}
                    animate={isGeneratingPreview}
                    intent={previewFailed ? "danger" : "none"}
                    disabled={disabled}
                />
            </FormGroup>

            <FormGroup
                label="Exporting to ZIP file"
                labelInfo={"(Status of rendering final images and creating ZIP file)"}
                helperText={<>Last export time: <b>{exportTimeDeltaStr}</b></>}
                disabled={disabled}
            >
                <ProgressBar
                    value={exportStatus.progress}
                    animate={isExporting}
                    intent={{done: "success", failed: "danger"}[exportStatus.state] ?? "primary"}
                    disabled={disabled}
                />
            </FormGroup>


            <FormGroup
                label="Image file prefix"
                labelInfo={"(optional)"}
                helperText={<>(File format will be <Code>prefix_%d.png</Code>). Name of all images will be saved to
                    files.txt file for convenience</>}
                disabled={disabled}
            >
                <InputGroup
                    large={false}
                    fill={false}
                    onChange={(e) => {
                        setFileNamePrefix(e.target.value)
                    }}
                    placeholder="File Name Prefix"
                    value={fileNamePrefix}
                    disabled={disabled}
                />
            </FormGroup>

            <Button
                intent={"primary"}
                large={true}
                onClick={exportToZip}
                loading={isExporting}
                disabled={disabled || previewFailed}
                icon={'download'}
            >
                Export and download ZIP file
            </Button>
        </Step>
    );
};

export default Export;
