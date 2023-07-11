"use client";

import React, { useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
import { VideoIcon, VideoOff } from "lucide-react";
import clsx from "clsx";
import { mono } from "@/lib/fonts";
import { PRICE } from "@/data/class";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Video() {
  const liveViewRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [results, setResults] = useState<any[]>([]);

  const [openCheckoutModal, setOpenCheckoutModal] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<any[]>([]); // [[object, quantity]]

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
      const ssd = await cocoSsd.load();
      setModel(ssd);
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

  // Prediction loop!
  async function predictWebcam() {
    model
      // @ts-ignore
      ?.detect(videoRef?.current)
      .then(function (predictions: any) {
        // Now lets loop through predictions and draw them to the live view if
        // they have a high confidence score.
        const multibbox = [];
        for (let n = 0; n < predictions.length; n++) {
          if (!Object.keys(PRICE).includes(predictions[n].class)) {
            continue;
          }

          // If we are over 66% sure we are sure we classified it right, draw it!
          if (predictions[n].score > 0.66) {
            const left = predictions[n].bbox[0];
            const top = predictions[n].bbox[1];
            const width = predictions[n].bbox[2];
            const height = predictions[n].bbox[3];
            const score = predictions[n].score;
            const _class = predictions[n].class;
            multibbox.push([left, top, width, height, score, _class]);
          }
        }
        setResults(multibbox);

        // Call this function again to keep predicting when the browser is ready.
        window.requestAnimationFrame(predictWebcam);
        // setAnimationId(id);
      })
      .catch(() => {});
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
              Products
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
                    {v} x RM {String(PRICE?.[k])}
                  </h3>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between w-full gap-2">
              <h3>Total: </h3>
              <h3>
                RM{" "}
                {[
                  ...results
                    // ?.filter((res) => !NOT_SHOWN_CLASSES?.includes(res?.[5]))
                    ?.map((res) => res?.[5])
                    ?.reduce((accumulator, value) => {
                      accumulator.set(value, (accumulator.get(value) || 0) + 1);

                      return accumulator;
                    }, new Map())
                    .entries(),
                ].reduce((p, [k, v]) => p + PRICE[k] * v, 0)}
              </h3>
            </div>
            <Dialog
              open={openCheckoutModal}
              onOpenChange={setOpenCheckoutModal}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    <p className="text-4xl !font-bold gradient from-purple-500 to-blue-500">
                      Checkout
                    </p>
                  </DialogTitle>
                  <div>
                    {checkoutItems?.map(([k, v], i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between w-full gap-2"
                      >
                        <h3>{String(k).toUpperCase()}</h3>
                        <h3>
                          {v} x RM {String(PRICE?.[k])}
                        </h3>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between w-full gap-2">
                    <h3>Total: </h3>
                    <h3>
                      RM{" "}
                      {checkoutItems?.reduce(
                        (p, [k, v]) => p + PRICE[k] * v,
                        0
                      )}
                    </h3>
                  </div>
                </DialogHeader>
              </DialogContent>
            </Dialog>
            <button
              onClick={() => {
                setCheckoutItems([
                  ...results
                    // ?.filter((res) => !NOT_SHOWN_CLASSES?.includes(res?.[5]))
                    ?.map((res) => res?.[5])
                    ?.reduce((accumulator, value) => {
                      accumulator.set(value, (accumulator.get(value) || 0) + 1);

                      return accumulator;
                    }, new Map())
                    .entries(),
                ]);
                setOpenCheckoutModal(true);
              }}
              disabled={false && results?.length === 0}
              className="flex items-center justify-center w-full px-4 py-4 mt-4 font-bold text-white transition-all border-2 border-purple-500 disabled:hover:from-purple-500 disabled:hover:to-blue-500 disabled:hover:text-white disabled:opacity-25 hover:from-white hover:to-white hover:text-purple-500 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl"
            >
              Checkout
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
