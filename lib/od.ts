import * as tf from "@tensorflow/tfjs";

export const xywh2xyxy = (x: any, y: any, w: any, h: any) => {
  const x1 = x - w / 2;
  const y1 = y - h / 2;
  const x2 = x + w / 2;
  const y2 = y + h / 2;
  return { x1, y1, x2, y2 };
};

export const preprocess = (
  source: HTMLVideoElement | null | any,
  modelWidth: any,
  modelHeight: any
) => {
  let xRatio, yRatio; // ratios for boxes

  const input = tf.tidy(() => {
    const img = tf.browser.fromPixels(source);

    // padding image to square => [n, m] to [n, n], n > m
    const [h, w] = img.shape.slice(0, 2); // get source width and height
    const maxSize = Math.max(w, h); // get max size
    const imgPadded: any = img.pad([
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
