import {
  StoryContent,
  type StoryRenderProps,
  type StoryScrollSceneRenderProps,
} from "@moritzbrantner/storytelling";
import { motion, useTransform, type MotionValue } from "motion/react";
import type { CSSProperties } from "react";

import type { MotionLabSceneData, SignalStoryData } from "./story";

const signalMeterColor: Record<SignalStoryData["tone"], string> = {
  amber: "bg-[#f1b851]",
  cyan: "bg-[#56d5c4]",
  green: "bg-[#8bd17c]",
  rose: "bg-[#ef8b72]",
};

export function SignalStage({ node, progress, currentIndex }: StoryRenderProps<SignalStoryData>) {
  const data = node.data;

  return (
    <section className="demo-stage relative min-h-[clamp(26rem,56vw,42rem)] overflow-hidden rounded-lg border border-white/30 bg-[#101615] text-white">
      {data ? (
        <img
          className="absolute inset-0 h-full w-full scale-[1.02] object-cover"
          src={data.imageSrc}
          alt={data.imageAlt}
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(8, 13, 12, 0.9), rgba(8, 13, 12, 0.42) 58%, rgba(8, 13, 12, 0.12)), linear-gradient(0deg, rgba(8, 13, 12, 0.82), rgba(8, 13, 12, 0.04) 46%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.16) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(90deg, black, transparent 78%)",
        }}
      />

      <div className="relative z-[1] grid min-h-[inherit] items-end gap-[clamp(1.5rem,4vw,4rem)] p-[clamp(1.25rem,4vw,3rem)] pb-[4.5rem]">
        <div className="max-w-[44rem]">
          {node.eyebrow ? (
            <p className="m-0 mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-white/70">
              {node.eyebrow}
            </p>
          ) : null}
          <h2 className="m-0 max-w-[11ch] text-[clamp(3rem,6vw,5.25rem)] leading-[0.92] tracking-normal">
            {node.title}
          </h2>
          <StoryContent
            content={node.content}
            className="mt-6 max-w-[38rem] text-white/80 [&_blockquote]:border-white/30 [&_blockquote]:text-white/90 [&_h2]:text-xl [&_h2]:leading-snug [&_h2]:text-white [&_h3]:text-xl [&_h3]:leading-snug [&_h3]:text-white [&_h4]:text-xl [&_h4]:leading-snug [&_h4]:text-white"
          />
        </div>

        <dl className="m-0 grid max-w-[22rem] gap-3 rounded-lg border border-white/20 bg-[#070c0b]/50 p-3 backdrop-blur-xl">
          <div className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
            <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/65">
              Scene
            </dt>
            <dd className="m-0 text-right text-sm font-bold text-white">
              {String(currentIndex + 1).padStart(2, "0")}
            </dd>
          </div>
          {data ? (
            <>
              <SignalStageReadout label={data.metricLabel} value={data.metricValue} />
              <SignalStageReadout label="Channel" value={data.channel} />
              <SignalStageReadout label="Location" value={data.location} />
            </>
          ) : null}
        </dl>
      </div>

      <div
        className="absolute inset-x-[clamp(1.25rem,4vw,3rem)] bottom-[clamp(1.25rem,4vw,3rem)] z-[2] h-1.5 overflow-hidden rounded-full bg-white/20"
        aria-hidden="true"
      >
        <span
          className={`block h-full rounded-[inherit] transition-[width] duration-200 ${
            signalMeterColor[data?.tone ?? "cyan"]
          }`}
          style={{ width: `${Math.max(progress * 100, 12)}%` }}
        />
      </div>
    </section>
  );
}

function SignalStageReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/65">{label}</dt>
      <dd className="m-0 text-right text-sm font-bold text-white [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

export function MotionLabScene({
  scene,
  sceneIndex,
  sceneCount,
  progress,
  scrollProgress,
  isActive,
}: StoryScrollSceneRenderProps<MotionLabSceneData>) {
  const data = scene.data;
  const imageScale = useTransform(scrollProgress, [0, 1], [1.1, 1.01]);
  const imageY = useTransform(scrollProgress, [0, 1], [22, -22]);
  const copyY = useTransform(scrollProgress, [0, 1], [44, -34]);
  const copyOpacity = useTransform(scrollProgress, [0, 0.16, 0.82, 1], [0.72, 1, 1, 0.64]);
  const instrumentY = useTransform(scrollProgress, [0, 1], [72, -18]);
  const meterScale = useTransform(scrollProgress, [0, 1], [0.08, 1]);

  return (
    <section
      className="relative grid min-h-full overflow-hidden bg-[#111817] text-white"
      style={{ "--motion-accent": data?.accent ?? "#56d5c4" } as CSSProperties}
    >
      {data ? (
        <motion.img
          className="absolute inset-0 h-full w-full object-cover [transform-origin:center]"
          src={data.imageSrc}
          alt={data.imageAlt}
          style={{ scale: imageScale, y: imageY }}
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(8, 12, 12, 0.9), rgba(8, 12, 12, 0.5) 48%, rgba(8, 12, 12, 0.1)), linear-gradient(0deg, rgba(8, 12, 12, 0.84), rgba(8, 12, 12, 0.08) 52%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.12) 1px, transparent 1px), radial-gradient(circle at 72% 24%, color-mix(in srgb, var(--motion-accent) 38%, transparent), transparent 27%)",
          backgroundSize: "48px 48px, 48px 48px, 100% 100%",
          maskImage: "linear-gradient(90deg, black, transparent 86%)",
        }}
      />

      <motion.div
        className="relative z-[1] max-w-[43rem] self-end p-[clamp(1.4rem,4vw,3.25rem)] pb-[18rem] min-[760px]:pb-[clamp(5rem,12vw,8rem)]"
        style={{ opacity: copyOpacity, y: copyY }}
      >
        {scene.eyebrow ? (
          <p className="m-0 mb-4 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--motion-accent)]">
            {scene.eyebrow}
          </p>
        ) : null}
        <h2 className="m-0 max-w-[8ch] text-[clamp(3.2rem,9vw,8rem)] leading-[0.86] tracking-normal min-[760px]:max-w-[9ch]">
          {scene.title}
        </h2>
        {data ? (
          <p className="m-0 mt-5 max-w-[35rem] text-[clamp(1rem,1.5vw,1.18rem)] leading-relaxed text-white/75">
            {data.deck}
          </p>
        ) : null}
      </motion.div>

      <motion.div
        className="absolute bottom-[clamp(1rem,3vw,2.5rem)] right-[clamp(1rem,3vw,2.5rem)] z-[2] w-[min(18rem,calc(100%-2rem))] rounded-lg border border-white/20 bg-[#080c0c]/60 p-3 backdrop-blur-xl"
        style={{ y: instrumentY }}
      >
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/50">
          <span>{String(sceneIndex + 1).padStart(2, "0")}</span>
          <span>{String(sceneCount).padStart(2, "0")}</span>
        </div>
        {data ? (
          <div className="mt-3 grid grid-cols-[1fr_auto] items-baseline gap-4 border-t border-white/10 pt-3">
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60">
              {data.metricLabel}
            </span>
            <strong className="text-3xl leading-none text-[var(--motion-accent)]">
              {data.metricValue}
            </strong>
          </div>
        ) : null}
        <ul className="m-0 mt-4 grid list-none gap-2 p-0">
          {data?.readouts.map((readout, index) => (
            <MotionLabReadout
              key={readout.label}
              index={index}
              readout={readout}
              scrollProgress={scrollProgress}
            />
          ))}
        </ul>
      </motion.div>

      <div
        className="absolute inset-x-[clamp(1.4rem,4vw,3.25rem)] bottom-[clamp(1.2rem,3vw,2rem)] z-[3] h-1.5 overflow-hidden rounded-full bg-white/15"
        aria-hidden="true"
      >
        <motion.span
          className="block h-full w-full origin-left rounded-[inherit] bg-[var(--motion-accent)]"
          style={{ scaleX: meterScale }}
        />
      </div>
      <span
        className="absolute right-[clamp(1.4rem,4vw,3.25rem)] top-[clamp(1.4rem,4vw,3.25rem)] z-[2] text-[clamp(4rem,12vw,9rem)] font-extrabold leading-[0.8] text-white/30"
        aria-hidden="true"
      >
        {Math.round(progress * 100)
          .toString()
          .padStart(2, "0")}
      </span>
      <span
        className="pointer-events-none absolute inset-0 z-[4] border border-[color-mix(in_srgb,var(--motion-accent)_56%,transparent)] opacity-0 data-[active=true]:opacity-100"
        data-active={isActive ? "true" : "false"}
      />
    </section>
  );
}

function MotionLabReadout({
  index,
  readout,
  scrollProgress,
}: {
  index: number;
  readout: MotionLabSceneData["readouts"][number];
  scrollProgress: MotionValue<number>;
}) {
  const y = useTransform(scrollProgress, [0, 1], [18 + index * 10, -12 - index * 8]);
  const opacity = useTransform(scrollProgress, [0, 0.18 + index * 0.08, 1], [0.52, 1, 0.82]);

  return (
    <motion.li
      className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-t border-white/10 pt-2"
      style={{ opacity, y }}
    >
      <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60">
        {readout.label}
      </span>
      <strong className="text-sm text-white">{readout.value}</strong>
    </motion.li>
  );
}
