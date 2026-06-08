import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  StoryAudioFile,
  StorySubtitleFile,
  StoryVideoFile,
  createAudioStoryScene,
  createSubtitleStoryScene,
  createVideoStoryScene,
  formatSubtitleTime,
  parseSubtitleText,
} from "./media";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("story media", () => {
  test("parses subtitle text across SRT, VTT, skipped blocks, and invalid cues", () => {
    expect(parseSubtitleText("")).toEqual([]);
    expect(
      parseSubtitleText(
        "1\n00:00:00,000 --> 00:00:01,500\nHello\n\n2\n00:00:02,000 --> 00:00:03,000\nWorld",
      ).map((cue) => cue.text),
    ).toEqual(["Hello", "World"]);
    expect(
      parseSubtitleText("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nVTT cue").map((cue) => cue.text),
    ).toEqual(["VTT cue"]);
    expect(
      parseSubtitleText(
        [
          "WEBVTT",
          "",
          "NOTE ignored",
          "",
          "STYLE",
          "::cue { color: white; }",
          "",
          "REGION",
          "id:region",
          "",
          "X-TIMESTAMP-MAP=MPEGTS:0,LOCAL:00:00:00.000",
          "",
          "00:00:01.000 --> 00:00:02.000",
          "Visible",
        ].join("\n"),
      ).map((cue) => cue.text),
    ).toEqual(["Visible"]);
    expect(
      parseSubtitleText(
        [
          "No timing",
          "",
          "bad --> 00:00:01.000",
          "Bad start",
          "",
          "00:00:02.000 --> 00:00:01.000",
          "Backwards",
          "",
          "00:00:03.000 --> 00:00:04.000",
          "",
          "00:00:05.000 --> 00:00:06.000",
          "Good",
        ].join("\n"),
      ).map((cue) => cue.text),
    ).toEqual(["Good"]);
    expect(
      parseSubtitleText("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nForced", "srt"),
    ).toHaveLength(1);
    expect(parseSubtitleText("00:00:00.000 --> 00:00:01.000\nForced", "vtt")).toHaveLength(1);
  });

  test("formats subtitle timestamps", () => {
    expect(formatSubtitleTime(0)).toBe("00:00.000");
    expect(formatSubtitleTime(-5)).toBe("00:00.000");
    expect(formatSubtitleTime(65.25)).toBe("01:05.250");
    expect(formatSubtitleTime(3661.5)).toBe("01:01:01.500");
  });

  test("renders inline subtitle files with empty and timestamp states", () => {
    const { container, rerender } = render(
      <StorySubtitleFile content={"1\n00:00:00.000 --> 00:00:01.000\nInline cue"} />,
    );

    expect(screen.getByText("Inline subtitles")).toBeTruthy();
    expect(screen.getByText("Inline cue")).toBeTruthy();
    expect(screen.getByText(/00:00.000 - 00:01.000/)).toBeTruthy();

    rerender(
      <StorySubtitleFile
        content={"1\n00:00:00.000 --> 00:00:01.000\nHidden timestamp"}
        showTimestamps={false}
        title="Captions"
        description={<span>Caption description</span>}
        languageLabel="English captions"
        className="subtitle-shell"
        listClassName="subtitle-list"
      />,
    );

    expect(screen.getByText("Captions")).toBeTruthy();
    expect(screen.getByText("Caption description")).toBeTruthy();
    expect(screen.getByText("English captions")).toBeTruthy();
    expect(screen.getByText("Hidden timestamp")).toBeTruthy();
    expect(screen.queryByText(/00:00.000 - 00:01.000/)).toBeNull();
    expect(container.querySelector(".subtitle-shell")).toBeTruthy();
    expect(container.querySelector(".subtitle-list")).toBeTruthy();

    rerender(<StorySubtitleFile emptyLabel="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  test("loads subtitle files from src and reports fetch failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nFetched cue",
      })),
    );

    const { rerender } = render(
      <StorySubtitleFile src="/captions/example.vtt" loadingLabel="Loading captions" />,
    );

    expect(screen.getByText("Loading captions")).toBeTruthy();
    expect(await screen.findByText("Fetched cue")).toBeTruthy();
    expect(screen.getByText("example.vtt")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/captions/example.vtt");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    rerender(<StorySubtitleFile src="/captions/missing.srt" errorLabel="Could not load" />);

    await waitFor(() => expect(screen.getByText("Could not load")).toBeTruthy());
  });

  test("renders audio files with filename fallbacks, artwork, tracks, and placeholders", () => {
    const { container, rerender } = render(<StoryAudioFile src="/audio/story.mp3?cache=1" />);

    expect(screen.getByText("story.mp3")).toBeTruthy();
    expect(screen.getByText("mp3")).toBeTruthy();
    expect(screen.getByText("Audio")).toBeTruthy();

    rerender(
      <StoryAudioFile
        src="/audio/custom.ogg"
        title="Custom audio"
        description={<span>Audio description</span>}
        artworkSrc="/artwork.png"
        playerClassName="audio-player"
        tracks={[
          {
            src: "/captions/audio.vtt",
            label: "English",
            srcLang: "en",
            kind: "captions",
            default: true,
          },
        ]}
      />,
    );

    const audio = container.querySelector("audio")!;
    const track = container.querySelector("track")!;

    expect(screen.getByText("Custom audio")).toBeTruthy();
    expect(screen.getByText("Audio description")).toBeTruthy();
    expect(container.querySelector('img[src="/artwork.png"]')).toBeTruthy();
    expect(audio.controls).toBe(true);
    expect(audio.preload).toBe("metadata");
    expect(audio.getAttribute("src")).toBe("/audio/custom.ogg");
    expect(audio.className).toContain("audio-player");
    expect(track.getAttribute("label")).toBe("English");
    expect(track.getAttribute("src")).toBe("/captions/audio.vtt");
    expect(track.getAttribute("kind")).toBe("captions");
    expect(track.getAttribute("srclang")).toBe("en");
    expect(track.hasAttribute("default")).toBe(true);
  });

  test("renders video files with filename fallbacks and tracks", () => {
    const { container, rerender } = render(<StoryVideoFile src="/video/story.mp4#clip" />);

    expect(screen.getByText("story.mp4")).toBeTruthy();
    expect(screen.getByText("mp4")).toBeTruthy();

    rerender(
      <StoryVideoFile
        src="/video/custom.webm"
        title="Custom video"
        description={<span>Video description</span>}
        playerClassName="video-player"
        tracks={[{ src: "/captions/video.vtt", label: "English", srcLang: "en" }]}
      />,
    );

    const video = container.querySelector("video")!;
    const track = container.querySelector("track")!;

    expect(screen.getByText("Custom video")).toBeTruthy();
    expect(screen.getByText("Video description")).toBeTruthy();
    expect(video.controls).toBe(true);
    expect(video.preload).toBe("metadata");
    expect(video.playsInline).toBe(true);
    expect(video.getAttribute("src")).toBe("/video/custom.webm");
    expect(video.className).toContain("video-player");
    expect(track.getAttribute("label")).toBe("English");
    expect(track.getAttribute("src")).toBe("/captions/video.vtt");
    expect(track.getAttribute("kind")).toBeNull();
    expect(track.getAttribute("srclang")).toBe("en");
  });

  test("creates media-backed story stage components", () => {
    const SubtitleScene = createSubtitleStoryScene({
      content: "1\n00:00:00.000 --> 00:00:01.000\nScene subtitle",
    });
    const AudioScene = createAudioStoryScene({ src: "/audio/scene.mp3" });
    const VideoScene = createVideoStoryScene({ src: "/video/scene.mp4" });
    const subtitleProps = {} as ComponentProps<typeof SubtitleScene>;
    const audioProps = {} as ComponentProps<typeof AudioScene>;
    const videoProps = {} as ComponentProps<typeof VideoScene>;

    expect(SubtitleScene.displayName).toBe("SubtitleStoryScene");
    expect(AudioScene.displayName).toBe("AudioStoryScene");
    expect(VideoScene.displayName).toBe("VideoStoryScene");

    const { rerender } = render(<SubtitleScene {...subtitleProps} />);
    expect(screen.getByText("Scene subtitle")).toBeTruthy();

    rerender(<AudioScene {...audioProps} />);
    expect(screen.getByText("scene.mp3")).toBeTruthy();

    rerender(<VideoScene {...videoProps} />);
    expect(screen.getByText("scene.mp4")).toBeTruthy();
  });
});
