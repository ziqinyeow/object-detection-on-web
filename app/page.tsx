import Video from "@/components/Video";
import { Scan } from "lucide-react";
import { Metadata } from "next";

const title =
  "Scan and Shop - AI Tool for seamless on prem shopping experiences";
const description =
  "Scan and Shop is a native web applications that can detect and scan object on the fly and record the number of items in the list.";

export const metadata: Metadata = {
  title,
  description,
};

export default function Home() {
  return (
    <>
      <main className="flex flex-col max-w-[640px] mx-auto xl:max-w-5xl">
        <section className="w-full px-6 py-8 my-10 border-2 border-black rounded-3xl">
          <div className="flex items-center gap-4">
            <Scan className="w-8 h-8 text-purple-500" />
            <p className="text-4xl font-bold gradient from-purple-500 to-blue-500">
              Scan and Shop
            </p>
          </div>
        </section>
        <Video />
      </main>
    </>
  );
}
