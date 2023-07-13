"use client";

import React, { useEffect, useRef, useState } from "react";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";

import { VideoIcon, VideoOff } from "lucide-react";
import clsx from "clsx";
import { mono } from "@/lib/fonts";

// TODO: make dynamic
const YOLO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse",
    "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie",
    "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon",
    "bowl", "banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut",
    "cake", "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book",
    "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
]

export default function Video() {
    const liveViewRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [model, setModel] = useState<tf.GraphModel | null>(null);
    const [results, setResults] = useState<any[]>([]);

    const hasGetUserMedia = () => {
        if (typeof window !== "undefined") {
            // Client-side-only code
            return !!(
                window.navigator.mediaDevices &&
                window.navigator.mediaDevices.getUserMedia
            );
        }
    };

    useEffect(() => {
        (async () => {
            const _model = await tf.loadGraphModel("/model/yolov8s_web_model/model.json");
            setModel(_model);
            console.log(_model);
        })();
    }, []);

    const enableCam = () => {
        const constraints = {
            audio: false,
            video: {
                facingMode: "environment",
            },
        };

        // Activate the webcam stream.
        navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
            // @ts-ignore
            videoRef.current.srcObject = stream;
            // @ts-ignore
            videoRef.current.addEventListener("loadeddata", predictWebcam);
        });
    };

    const disableCam = () => {
        // @ts-ignore
        videoRef.current.srcObject = null;
        videoRef.current?.removeEventListener("loadeddata", predictWebcam);
        setResults([]);
    };

    /**
    * Preprocess image / frame before forwarded into the model
    * @param {HTMLVideoElement|HTMLImageElement} source
    * @param {Number} modelWidth
    * @param {Number} modelHeight
    * @returns input tensor, xRatio and yRatio
    */
    const preprocess = (source: any, modelWidth: number, modelHeight: number) => {
        let xRatio, yRatio; // ratios for boxes

        const input = tf.tidy(() => {
            const img = tf.browser.fromPixels(source);

            // padding image to square => [n, m] to [n, n], n > m
            const [h, w] = img.shape.slice(0, 2); // get source width and height
            const maxSize = Math.max(w, h); // get max size
            const imgPadded = img.pad([
                [0, maxSize - h], // padding y [bottom only]
                [0, maxSize - w], // padding x [right only]
                [0, 0],
            ]);

            xRatio = maxSize / w; // update xRatio
            yRatio = maxSize / h; // update yRatio

            return tf.image
                .resizeBilinear(imgPadded, [modelWidth, modelHeight]) // resize frame
                .div(255.0) // normalize
                .expandDims(0); // add batch
        });

        return [input, xRatio, yRatio];
    };

    // Prediction loop!
    async function predictWebcam() {
        // @ts-ignore
        tf.engine().startScope();
        const [modelHeight, modelWidth] = model?.inputs[0].shape.slice(1, 3);
        const [input, xRatio, yRatio] = preprocess(videoRef.current, modelWidth, modelHeight)

        let res = model?.predict(input); // 1 x 84 x 8400

        if (!res) return;
        console.log("res", res.shape)

        const transRes = res.transpose([0, 2, 1]); // 1 x 8400 x 84
        console.log("transRes", transRes.shape)

        // 8400 bounding boxes x (4 xywh + 80 classes) params = 8400 x 84
        // means each predicted image can have a maximum of 8400 bounding boxes

        const boxes = tf.tidy(() => {
            const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
            const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
            const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2)); // x1
            const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2)); // y1
            return tf
                .concat(
                    [
                        x1, // top left x coord
                        y1, // top left y coord
                        w,
                        h
                        // tf.add(y1, h), // y2
                        // tf.add(x1, w), // x2
                    ],
                    2
                )
                .squeeze();
        }); // process boxes [y1, x1, w, h]

        console.log("boxes", boxes.shape) // 8400 x 4

        const [scores, classes] = tf.tidy(() => {
            // 8400 x 80, if numClass = 80 (notice the first 4 dims is being sliced out)
            const rawScores = transRes.slice([0, 0, 4], [-1, -1, YOLO_CLASSES.length]).squeeze(); // class scores
            return [rawScores.max(1), rawScores.argMax(1)]; // get the max value along the index 1
        }); // get max scores and classes index

        console.log("SCORES", scores) // 8400
        console.log("CLASSES", classes) // 8400

        const maxOutputSize = 100; // maximum count of the stated boxes that is to be picked
        const iouThreshold = 0.55;
        const scoreThreshold = 0.3;
        const nms = await tf.image.nonMaxSuppressionAsync(boxes, scores, maxOutputSize, iouThreshold, scoreThreshold); // NMS to filter boxes

        console.log("NMS boxes data: ", boxes.gather(nms, 0).shape)
        console.log("NMS scores data: ", scores.gather(nms, 0).shape)
        console.log("NMS classes data: ", classes.gather(nms, 0).shape)

        const boxes_data = boxes.gather(nms, 0).arraySync(); // indexing boxes by nms index, then getting raw values and preserve the original shape of boxes
        const scores_data = scores.gather(nms, 0).dataSync(); // indexing scores by nms index
        const classes_data = classes.gather(nms, 0).dataSync(); // indexing classes by nms index

        console.log("boxes_data", boxes_data)
        console.log("scores_data", scores_data)
        console.log("classes_data", classes_data)

        const multibbox = []
        for (let n = 0; n < scores_data.length; n++) {
            const topLeftX = boxes_data[n][0];
            const topLeftY = boxes_data[n][1];
            const width = boxes_data[n][2];
            const height = boxes_data[n][3];
            const score = scores_data[n];
            const _class = YOLO_CLASSES[classes_data[n]];
            multibbox.push([topLeftX, topLeftY, width, height, score, _class]);
        }

        console.log("multibbox --->>>>", multibbox)

        setResults(multibbox);

        tf.engine().endScope();
        window.requestAnimationFrame(predictWebcam);
    }

    return (
        <>
            <section className="flex flex-col items-center justify-between gap-4 mb-20 xl:flex-row">
                <div
                    ref={liveViewRef}
                    className="relative h-[480px] min-w-[640px] w-[640px] border-2 border-black rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 overflow-hidden"
                >
                    <div className="absolute flex items-center justify-center w-full bottom-4 z-[4]">
                        <div className="bg-white border-2 border-black rounded-full cursor-pointer hover:text-white hover:bg-emerald-500">
                            {videoRef.current?.srcObject ? (
                                <button
                                    className="flex items-center gap-2 px-8 py-4 text-xs disabled:cursor-not-allowed rounded-xl"
                                    disabled={!hasGetUserMedia() || !model}
                                    onClick={disableCam}
                                >
                                    <VideoIcon className="w-5 h-5" strokeWidth={2} />
                                </button>
                            ) : (
                                <button
                                    className="flex items-center gap-2 px-8 py-4 text-xs disabled:cursor-not-allowed rounded-xl"
                                    disabled={!hasGetUserMedia() || !model}
                                    onClick={enableCam}
                                >
                                    <VideoOff className="w-5 h-5" strokeWidth={2} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="w-full overflow-auto">
                        <video
                            ref={videoRef}
                            className="clear-both rounded-xl"
                            autoPlay
                        ></video>
                    </div>
                    {results
                        // ?.filter((res) => !NOT_SHOWN_CLASSES?.includes(res?.[5]))
                        ?.map(([left, top, width, height, score, _class], i) => (
                            <React.Fragment key={i}>
                                <div
                                    className="bg-emerald-200 bg-opacity-25 z-[1] absolute border-dashed"
                                    style={{
                                        left: left + "px",
                                        top: top + "px",
                                        width: width + "px",
                                        height: height + "px",
                                    }}
                                />
                                <p
                                    className={clsx([
                                        "absolute p-1 bg-orange-400 text-white border-dashed z-[2] text-sm m-0",
                                        mono.className,
                                    ])}
                                    style={{
                                        left: left + "px",
                                        top: top + "px",
                                        width: width - 10 + "px",
                                    }}
                                >
                                    {_class +
                                        " - with " +
                                        Math.round(parseFloat(score) * 100) +
                                        "% confidence."}
                                </p>
                            </React.Fragment>
                        ))}
                </div>
                <div
                    className={clsx([
                        "w-full border-2 border-black p-5 min-h-[480px] flex flex-col justify-between gap-1 rounded-2xl",
                        mono.className,
                    ])}
                >
                    <div>
                        <p className="text-3xl font-bold gradient from-purple-500 to-blue-500">
                            Detected
                        </p>
                        <div className={clsx(["mt-3 space-y-3 mb-5"])}>
                            {[
                                ...results
                                    // ?.filter((res) => !NOT_SHOWN_CLASSES?.includes(res?.[5]))
                                    ?.map((res) => res?.[5])
                                    ?.reduce((accumulator, value) => {
                                        accumulator.set(value, (accumulator.get(value) || 0) + 1);

                                        return accumulator;
                                    }, new Map())
                                    .entries(),
                            ]?.map(([k, v], i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between w-full gap-2"
                                >
                                    <h3>{String(k).toUpperCase()}</h3>
                                    <h3>
                                        {v}
                                    </h3>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </section>
        </>
    );
}
