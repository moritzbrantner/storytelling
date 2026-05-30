import {
  StoryContent,
  createStoryRendererRegistry,
  defineStory,
  type StoryDocument,
  type StoryScrollScene,
  type StoryScrollSceneRenderProps,
  type StoryRenderProps,
} from "@moritzbrantner/storytelling";
import { motion, useTransform, type MotionValue } from "motion/react";
import type { CSSProperties } from "react";

export type SignalStoryData = {
  channel: string;
  imageAlt: string;
  imageSrc: string;
  intensity: number;
  location: string;
  metricLabel: string;
  metricValue: string;
  tone: "amber" | "cyan" | "green" | "rose";
};

export type MotionLabSceneData = {
  accent: string;
  deck: string;
  imageAlt: string;
  imageSrc: string;
  metricLabel: string;
  metricValue: string;
  readouts: { label: string; value: string }[];
};

export const signalStory = defineStory<SignalStoryData>({
  id: "observatory-relay",
  title: "Observatory Relay",
  subtitle: "A branching signal story",
  openingNodeId: "wake",
  labels: {
    choosePrompt: "Choose the next move.",
    completedBranch: "This branch is complete.",
    continue: "Continue",
    restart: "Restart",
    scrollerLabel: "Observatory Relay scroller",
  },
  defaults: {
    durationInFrames: 120,
    transitionInFrames: 16,
  },
  nodes: [
    {
      id: "wake",
      title: "Wake the observatory",
      eyebrow: "Incoming",
      prompt: "Route the signal.",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "L-14",
        imageAlt: "A mountain observatory under a star field",
        imageSrc:
          "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=80",
        intensity: 72,
        location: "North Ridge Array",
        metricLabel: "Signal lock",
        metricValue: "72%",
        tone: "cyan",
      },
      content: [
        {
          type: "paragraph",
          text: "The midnight receiver catches a repeating pulse under the weather band.",
        },
        {
          type: "list",
          items: ["Three clean repeats", "Weak carrier drift", "No registered flight plan"],
        },
      ],
      choices: [
        {
          id: "answer",
          label: "Answer the pulse",
          description: "Open a voice channel before the signal fades.",
          target: "pilot",
        },
        {
          id: "trace",
          label: "Trace the source",
          description: "Hold transmission and triangulate the coordinates.",
          target: "harbor",
        },
        {
          id: "archive",
          label: "Check the archive",
          description: "Compare the pattern against old expedition logs.",
          target: "archive",
        },
      ],
    },
    {
      id: "pilot",
      title: "A pilot breaks through",
      eyebrow: "Voice",
      prompt: "Keep the pilot talking.",
      next: "runway",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "VHF 9",
        imageAlt: "A cockpit view over clouds at sunrise",
        imageSrc:
          "https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&w=1400&q=80",
        intensity: 88,
        location: "Cloud deck east",
        metricLabel: "Voice clarity",
        metricValue: "88%",
        tone: "amber",
      },
      content: [
        {
          type: "quote",
          text: "Relay tower, this is Kestrel Nine. I have lights below me where the chart shows water.",
          cite: "Kestrel Nine",
        },
        {
          type: "paragraph",
          text: "The pilot's transponder appears for one sweep, then drops behind a wall of static.",
        },
      ],
    },
    {
      id: "runway",
      title: "Lights align on the ridge",
      eyebrow: "Approach",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "ILS ghost",
        imageAlt: "Runway lights cutting through fog at night",
        imageSrc:
          "https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1400&q=80",
        intensity: 96,
        location: "Ridge line",
        metricLabel: "Approach fix",
        metricValue: "Locked",
        tone: "green",
      },
      content: [
        {
          type: "paragraph",
          text: "The array paints a landing path across ground that should be empty rock.",
        },
        {
          type: "heading",
          text: "The pilot has a corridor.",
        },
      ],
    },
    {
      id: "harbor",
      title: "The map reveals a hidden harbor",
      eyebrow: "Triangulated",
      prompt: "Choose what to do with the coordinates.",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Bearing 032",
        imageAlt: "A sheltered harbor bordered by dark cliffs",
        imageSrc:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
        intensity: 64,
        location: "Unmarked inlet",
        metricLabel: "Coordinate fit",
        metricValue: "64%",
        tone: "green",
      },
      content: [
        {
          type: "paragraph",
          text: "The cove was removed from civilian charts after a storm changed the coastline.",
        },
      ],
      choices: [
        {
          id: "send-team",
          label: "Send a field team",
          description: "Dispatch a ground crew before weather closes in.",
          target: "field-team",
        },
        {
          id: "broadcast",
          label: "Broadcast the fix",
          description: "Share the coordinates with every receiver in range.",
          target: "broadcast",
        },
      ],
    },
    {
      id: "field-team",
      title: "The field team finds the beacon",
      eyebrow: "Recovered",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Rescue band",
        imageAlt: "A search team crossing wet ground with headlamps",
        imageSrc:
          "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80",
        intensity: 91,
        location: "Old harbor road",
        metricLabel: "Beacon range",
        metricValue: "91%",
        tone: "rose",
      },
      content: [
        {
          type: "paragraph",
          text: "Inside the beacon case is a dry logbook, still wrapped in waxed canvas.",
        },
      ],
    },
    {
      id: "broadcast",
      title: "Every receiver answers back",
      eyebrow: "Network",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Open relay",
        imageAlt: "A radio tower above a city at dusk",
        imageSrc:
          "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80",
        intensity: 99,
        location: "Regional mesh",
        metricLabel: "Relay spread",
        metricValue: "99%",
        tone: "cyan",
      },
      content: [
        {
          type: "paragraph",
          text: "The hidden harbor becomes a shared waypoint in less than a minute.",
        },
      ],
    },
    {
      id: "archive",
      title: "The archive names the pattern",
      eyebrow: "Recovered log",
      next: "archive-ending",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Tape 31B",
        imageAlt: "Shelves of archive boxes in warm light",
        imageSrc:
          "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=80",
        intensity: 58,
        location: "Basement stacks",
        metricLabel: "Pattern match",
        metricValue: "58%",
        tone: "amber",
      },
      content: [
        {
          type: "paragraph",
          text: "A survey crew logged the same pulse thirty years ago, then marked the page with one word: shelter.",
        },
      ],
    },
    {
      id: "archive-ending",
      title: "A route opens in the old log",
      eyebrow: "Shelter",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Logbook",
        imageAlt: "A marked route drawn across a paper map",
        imageSrc:
          "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1400&q=80",
        intensity: 83,
        location: "Hand-drawn chart",
        metricLabel: "Route confidence",
        metricValue: "83%",
        tone: "rose",
      },
      content: [
        {
          type: "paragraph",
          text: "The old route still lines up with the modern ridge road, down to the last switchback.",
        },
      ],
    },
  ],
});

export const extendedRelayStory = defineStory<SignalStoryData>({
  id: "observatory-relay-extended",
  title: "Extended Relay Route",
  subtitle: "A longer branch-heavy relay mission",
  openingNodeId: "relay-awakening",
  labels: {
    choosePrompt: "Choose the next move.",
    completedBranch: "This branch is complete.",
    continue: "Continue",
    restart: "Restart",
      scrollerLabel: "Extended Relay Route scroller",
  },
  defaults: {
    durationInFrames: 110,
    transitionInFrames: 16,
  },
  nodes: [
    {
      id: "relay-awakening",
      title: "Relay awakening",
      eyebrow: "Opening",
      prompt: "Sort the channels before the next interval drops.",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "R-01",
        imageAlt: "An observatory tower on a moonlit ridge",
        imageSrc:
          "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1400&q=80",
        intensity: 66,
        location: "Signal ridge",
        metricLabel: "Signal lock",
        metricValue: "66%",
        tone: "cyan",
      },
      content: [
        {
          type: "paragraph",
          text: "A late-night beacon wakes three independent tracks at once.",
        },
        {
          type: "list",
          items: ["Pilot traffic", "Unmapped source", "A familiar archive ping"],
        },
      ],
      choices: [
        {
          id: "answer-pilot",
          label: "Answer the pilot",
          description: "Keep the flight on one-line.",
          target: "pilot-check",
        },
        {
          id: "trace-source",
          label: "Trace the source",
          description: "Hold the sweep and keep bearings fresh.",
          target: "trace-scan",
        },
        {
          id: "archive-review",
          label: "Review the archive",
          description: "Compare the pattern to older relief logs.",
          target: "archive-index",
        },
      ],
    },
    {
      id: "pilot-check",
      title: "Pilot signature locks in",
      eyebrow: "Pilot route",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Pilot band",
        imageAlt: "Cockpit lights against a rainy window",
        imageSrc:
          "https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&w=1400&q=80",
        intensity: 84,
        location: "Cloud approach lane",
        metricLabel: "Audio clarity",
        metricValue: "84%",
        tone: "amber",
      },
      content: [
        {
          type: "paragraph",
          text: "The pilot answers with clipped breathing, unsure if this channel is official.",
        },
      ],
      next: "pilot-wave",
    },
    {
      id: "pilot-wave",
      title: "The wave is stable",
      eyebrow: "Pilot route",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "ILS",
        imageAlt: "A radar screen with a narrow green arc",
        imageSrc:
          "https://images.unsplash.com/photo-1516321497487-e288fb4c58f1?auto=format&fit=crop&w=1400&q=80",
        intensity: 91,
        location: "Approach shelf",
        metricLabel: "Carrier drift",
        metricValue: "Stable",
        tone: "green",
      },
      content: [
        {
          type: "paragraph",
          text: "Two beacons ring in and the transponder reads a false corridor.",
        },
      ],
      next: "pilot-decision",
    },
    {
      id: "pilot-decision",
      title: "Control asks for a route decision",
      eyebrow: "Pilot branch",
      prompt: "Choose the relay method.",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Relay ops",
        imageAlt: "A map table covered by a route overlay",
        imageSrc:
          "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
        intensity: 88,
        location: "Command room",
        metricLabel: "Route confidence",
        metricValue: "61%",
        tone: "rose",
      },
      choices: [
        {
          id: "stabilize-route",
          label: "Stabilize the route",
          description: "Hold the current corridor until weather updates.",
          target: "pilot-stabilize",
        },
        {
          id: "confirm-route",
          label: "Confirm alternate route",
          description: "Cut to a preapproved backup line.",
          target: "pilot-confirm",
        },
      ],
      content: [
        {
          type: "paragraph",
          text: "The signal is readable, but it is close to terrain echo.",
        },
      ],
    },
    {
      id: "pilot-stabilize",
      title: "Stabilized route active",
      eyebrow: "Pilot branch",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Corridor 4",
        imageAlt: "A long line of runway lights in dusk",
        imageSrc:
          "https://images.unsplash.com/photo-1506784926709-22f1ec3958c5?auto=format&fit=crop&w=1400&q=80",
        intensity: 95,
        location: "Low corridor",
        metricLabel: "Stability",
        metricValue: "95%",
        tone: "cyan",
      },
      content: [
        {
          type: "paragraph",
          text: "The route holds, and the pilot checks in with confidence.",
        },
      ],
      next: "relay-hub",
    },
    {
      id: "pilot-confirm",
      title: "Alternate route confirmed",
      eyebrow: "Pilot branch",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Fallback vector",
        imageAlt: "A compass and hand-drawn flight plan",
        imageSrc:
          "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1400&q=80",
        intensity: 74,
        location: "Secondary approach",
        metricLabel: "Fuel impact",
        metricValue: "+12%",
        tone: "amber",
      },
      content: [
        {
          type: "paragraph",
          text: "A longer line is possible, and the backup route still has clearance.",
        },
      ],
      next: "relay-hub",
    },
    {
      id: "trace-scan",
      title: "Unknown source appears on scan",
      eyebrow: "Source trace",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Bearing grid",
        imageAlt: "A dark inlet viewed from above",
        imageSrc:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
        intensity: 72,
        location: "Uncharted inlet",
        metricLabel: "Bearing fit",
        metricValue: "84%",
        tone: "green",
      },
      content: [
        {
          type: "paragraph",
          text: "The map says the cove vanished from civilian charts, then came back in a test band.",
        },
      ],
      next: "trace-grid",
    },
    {
      id: "trace-grid",
      title: "The coast map becomes two-branched",
      eyebrow: "Source trace",
      prompt: "How should the teams react?",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Chart band",
        imageAlt: "Coastal relief map on glowing screens",
        imageSrc:
          "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&w=1400&q=80",
        intensity: 78,
        location: "Outer harbor",
        metricLabel: "Coordinate certainty",
        metricValue: "78%",
        tone: "rose",
      },
      choices: [
        {
          id: "send-team",
          label: "Send a ground team",
          description: "Dispatch a rapid response team before darkness.",
          target: "trace-team",
        },
        {
          id: "broadcast-fix",
          label: "Broadcast mesh fix",
          description: "Publish the grid to neighboring relays.",
          target: "trace-broadcast",
        },
      ],
      content: [
        {
          type: "paragraph",
          text: "Both actions would reopen the route, but each closes a different safety gate.",
        },
      ],
    },
    {
      id: "trace-team",
      title: "Field team is en route",
      eyebrow: "Source trace",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Field",
        imageAlt: "A rescue truck crossing a narrow road",
        imageSrc:
          "https://images.unsplash.com/photo-1465101162946-4377e57745c3?auto=format&fit=crop&w=1400&q=80",
        intensity: 83,
        location: "Inlet road",
        metricLabel: "Team ETA",
        metricValue: "14m",
        tone: "cyan",
      },
      content: [
        {
          type: "paragraph",
          text: "A local crew confirms a signal source and locks relay on a temporary mast.",
        },
      ],
      next: "relay-hub",
    },
    {
      id: "trace-broadcast",
      title: "Mesh patch is active",
      eyebrow: "Source trace",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Mesh",
        imageAlt: "A network graph glowing in blue",
        imageSrc:
          "https://images.unsplash.com/photo-1518773553398-650c184e0bb5?auto=format&fit=crop&w=1400&q=80",
        intensity: 86,
        location: "Regional relay",
        metricLabel: "Patch spread",
        metricValue: "89%",
        tone: "amber",
      },
      content: [
        {
          type: "paragraph",
          text: "Other stations repeat the signal as a public route beacon.",
        },
      ],
      next: "relay-hub",
    },
    {
      id: "archive-index",
      title: "Archive index flags a match",
      eyebrow: "Archive",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Archive stack",
        imageAlt: "A shelf of labeled signal logs",
        imageSrc:
          "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80",
        intensity: 62,
        location: "Cold archive",
        metricLabel: "Similarity score",
        metricValue: "62%",
        tone: "green",
      },
      content: [
        {
          type: "paragraph",
          text: "A paper log from the 90s resembles the tone and delay pattern exactly.",
        },
      ],
      next: "archive-decoder",
    },
    {
      id: "archive-decoder",
      title: "Decoder suggests one of two leads",
      eyebrow: "Archive",
      prompt: "Which historical lead should be trusted?",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Legacy node",
        imageAlt: "A hand-scanned chart against a lamp",
        imageSrc:
          "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80",
        intensity: 68,
        location: "Old terminal",
        metricLabel: "Archive reliability",
        metricValue: "73%",
        tone: "cyan",
      },
      choices: [
        {
          id: "verify-archive",
          label: "Verify the archive note",
          description: "Pull the primary page and crosscheck with live telemetry.",
          target: "archive-verify",
        },
        {
          id: "archive-stash",
          label: "Use a secondary cache",
          description: "Fallback to a secondary signal source.",
          target: "archive-stash",
        },
      ],
      content: [
        {
          type: "paragraph",
          text: "One branch leads to a clear harbor route, the other to a weather diversion.",
        },
      ],
    },
    {
      id: "archive-verify",
      title: "Verified archive route restored",
      eyebrow: "Archive branch",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Primary log",
        imageAlt: "A stamped ledger on a weathered desk",
        imageSrc:
          "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1400&q=80",
        intensity: 89,
        location: "Research wing",
        metricLabel: "Variance",
        metricValue: "4.2°",
        tone: "rose",
      },
      content: [
        {
          type: "paragraph",
          text: "The verified route aligns with current wind and can be reused immediately.",
        },
      ],
      next: "relay-hub",
    },
    {
      id: "archive-stash",
      title: "Secondary cache is stale",
      eyebrow: "Archive branch",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Backup cache",
        imageAlt: "A cracked hard-drive tray in a dark room",
        imageSrc:
          "https://images.unsplash.com/photo-1527681602529-7be8ea8f8f54?auto=format&fit=crop&w=1400&q=80",
        intensity: 57,
        location: "Decommissioned rack",
        metricLabel: "Delay spread",
        metricValue: "18s",
        tone: "amber",
      },
      content: [
        {
          type: "paragraph",
          text: "The cached path still works, but margins are not as clean as expected.",
        },
      ],
      next: "relay-hub",
    },
    {
      id: "relay-hub",
      title: "Relay hub convergence",
      eyebrow: "Rejoin",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Hub uplink",
        imageAlt: "A glass operations room full of monitors",
        imageSrc:
          "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1400&q=80",
        intensity: 97,
        location: "Control center",
        metricLabel: "Convergence",
        metricValue: "100%",
        tone: "green",
      },
      content: [
        {
          type: "paragraph",
          text: "Every branch now shares one final path: confirm and release the clearance.",
        },
      ],
      next: "relay-check",
    },
    {
      id: "relay-check",
      title: "Clearance diagnostics run",
      eyebrow: "Finale",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Compliance",
        imageAlt: "An empty runway at sunrise",
        imageSrc:
          "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80",
        intensity: 93,
        location: "Regional command",
        metricLabel: "Verification",
        metricValue: "Pass",
        tone: "cyan",
      },
      content: [
        {
          type: "paragraph",
          text: "The safety check clears and the last safety channel closes.",
        },
      ],
      next: "network-clearance",
    },
    {
      id: "network-clearance",
      title: "Network clearance",
      eyebrow: "Ending",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Clearance",
        imageAlt: "A calm shoreline under sunrise",
        imageSrc:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
        intensity: 100,
        location: "Route secure",
        metricLabel: "Mission status",
        metricValue: "Clear",
        tone: "green",
      },
      content: [
        {
          type: "paragraph",
          text: "All branches align, and the relay route is open for scheduled handoff.",
        },
      ],
    },
  ],
});

export const linearStory = defineStory<SignalStoryData>({
  id: "morning-dispatch",
  title: "Morning Dispatch",
  subtitle: "A linear story with one route",
  openingNodeId: "briefing",
  labels: {
    completedBranch: "The linear story is complete.",
    continue: "Continue",
    endingPrompt: "The sequence has reached its ending.",
    restart: "Restart",
    scrollerLabel: "Morning Dispatch scroller",
  },
  defaults: {
    durationInFrames: 100,
    transitionInFrames: 14,
  },
  nodes: [
    {
      id: "briefing",
      title: "Brief the morning desk",
      eyebrow: "Scene 01",
      prompt: "Continue to the field report.",
      next: "field-report",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Desk 04",
        imageAlt: "A newsroom desk with notebooks and a laptop",
        imageSrc:
          "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
        intensity: 42,
        location: "City newsroom",
        metricLabel: "Briefing status",
        metricValue: "Ready",
        tone: "amber",
      },
      content: [
        {
          type: "paragraph",
          text: "The editor assigns one reporter to follow the first train over the repaired bridge.",
        },
        {
          type: "list",
          items: ["Confirm the route", "Record the first crossing", "File before noon"],
        },
      ],
    },
    {
      id: "field-report",
      title: "Ride the first train",
      eyebrow: "Scene 02",
      prompt: "Continue to the edit room.",
      next: "edit-room",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Car 12",
        imageAlt: "Train tracks crossing a steel bridge in morning light",
        imageSrc:
          "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1400&q=80",
        intensity: 67,
        location: "Harbor bridge",
        metricLabel: "Route progress",
        metricValue: "67%",
        tone: "green",
      },
      content: [
        {
          type: "paragraph",
          text: "Passengers fall quiet as the wheels reach the new span and the harbor opens below.",
        },
        {
          type: "quote",
          text: "It sounds ordinary again. That is the whole point.",
          cite: "Bridge engineer",
        },
      ],
    },
    {
      id: "edit-room",
      title: "Shape the report",
      eyebrow: "Scene 03",
      prompt: "Continue to publication.",
      next: "publish",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Edit bay",
        imageAlt: "An editor reviewing photos on a desktop monitor",
        imageSrc:
          "https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=1400&q=80",
        intensity: 81,
        location: "Photo desk",
        metricLabel: "Draft polish",
        metricValue: "81%",
        tone: "cyan",
      },
      content: [
        {
          type: "paragraph",
          text: "The story keeps its order: assignment, crossing, reaction, and what changes for commuters next.",
        },
        {
          type: "heading",
          text: "No branch is needed when the sequence is the point.",
        },
      ],
    },
    {
      id: "publish",
      title: "Publish at noon",
      eyebrow: "Scene 04",
      stage: { renderer: "signal-stage" },
      data: {
        channel: "Front page",
        imageAlt: "A printed newspaper on a cafe table",
        imageSrc:
          "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1400&q=80",
        intensity: 100,
        location: "Morning edition",
        metricLabel: "Sequence",
        metricValue: "Complete",
        tone: "rose",
      },
      content: [
        {
          type: "paragraph",
          text: "By noon, the repaired bridge is no longer a rumor. It is a route people can plan around.",
        },
      ],
    },
  ],
});

export const authoringDraftStory: StoryDocument<SignalStoryData> = {
  id: "observatory-draft",
  title: " ",
  subtitle: "An intentionally rough authoring draft",
  openingNodeId: "wake",
  labels: {
    choosePrompt: "Choose the next move.",
    completedBranch: "This branch is complete.",
    continue: "Continue",
  },
  nodes: [
    {
      id: "wake",
      title: "Wake the observatory",
      prompt: "Route the signal.",
      choices: [
        {
          id: "trace",
          label: "Trace the source",
          description: " ",
          target: "harbor",
        },
      ],
      data: {
        channel: "Draft",
        imageAlt: "A rough draft radio desk",
        imageSrc:
          "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80",
        intensity: 34,
        location: "Draft room",
        metricLabel: "Completeness",
        metricValue: "34%",
        tone: "cyan",
      },
    },
    {
      id: "harbor",
      title: "Harbor draft",
      content: [{ type: "paragraph", text: "The coordinates point toward an old inlet." }],
      data: {
        channel: "Bearing",
        imageAlt: "A draft map on a desk",
        imageSrc:
          "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1400&q=80",
        intensity: 58,
        location: "Map desk",
        metricLabel: "Route confidence",
        metricValue: "58%",
        tone: "green",
      },
    },
    {
      id: "locked",
      title: "Locked branch",
      choices: [
        {
          id: "disabled",
          label: "Disabled route",
          target: "harbor",
          disabled: true,
        },
      ],
      data: {
        channel: "Disabled",
        imageAlt: "A locked notebook on a work table",
        imageSrc:
          "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80",
        intensity: 12,
        location: "Draft archive",
        metricLabel: "Ready",
        metricValue: "No",
        tone: "rose",
      },
    },
  ],
};

export const storyRegistry = createStoryRendererRegistry<SignalStoryData>({
  web: {
    "signal-stage": SignalStage,
  },
});

export const motionLabScenes: StoryScrollScene<MotionLabSceneData>[] = [
  {
    id: "motion-lab-signal",
    title: "Signal resolves",
    eyebrow: "Motion 01",
    data: {
      accent: "#56d5c4",
      deck: "A low-band scan gathers into one readable carrier as the scroll value crosses the frame.",
      imageAlt: "Radio astronomy dishes under a clear sky",
      imageSrc:
        "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1400&q=80",
      metricLabel: "Lock",
      metricValue: "0.74",
      readouts: [
        { label: "Drift", value: "-02.1" },
        { label: "Band", value: "L" },
        { label: "Noise", value: "18 dB" },
      ],
    },
    render: (props) => <MotionLabScene {...props} />,
  },
  {
    id: "motion-lab-field",
    title: "Field shifts",
    eyebrow: "Motion 02",
    data: {
      accent: "#f1b851",
      deck: "Foreground instruments slide at a different rate than the horizon while the fade preview enters.",
      imageAlt: "A desert research station at dusk",
      imageSrc:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
      metricLabel: "Vector",
      metricValue: "032",
      readouts: [
        { label: "Bearing", value: "032" },
        { label: "Range", value: "14 km" },
        { label: "Cloud", value: "6/10" },
      ],
    },
    render: (props) => <MotionLabScene {...props} />,
  },
  {
    id: "motion-lab-relay",
    title: "Relay opens",
    eyebrow: "Motion 03",
    transitionToNext: { type: "none" },
    data: {
      accent: "#ef8b72",
      deck: "The local relay hands off cleanly, using a direct boundary before the final confirmation frame.",
      imageAlt: "A communications tower silhouetted by city lights",
      imageSrc:
        "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80",
      metricLabel: "Spread",
      metricValue: "99%",
      readouts: [
        { label: "Nodes", value: "128" },
        { label: "Delay", value: "22 ms" },
        { label: "Queue", value: "Clear" },
      ],
    },
    render: (props) => <MotionLabScene {...props} />,
  },
  {
    id: "motion-lab-archive",
    title: "Archive lands",
    eyebrow: "Motion 04",
    data: {
      accent: "#8bd17c",
      deck: "The final frame eases the image, headline, instrument cluster, and progress bar into alignment.",
      imageAlt: "A marked paper map on a work table",
      imageSrc:
        "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1400&q=80",
      metricLabel: "Match",
      metricValue: "83%",
      readouts: [
        { label: "Route", value: "Found" },
        { label: "Source", value: "Tape 31B" },
        { label: "Status", value: "Filed" },
      ],
    },
    render: (props) => <MotionLabScene {...props} />,
  },
];

export const autoscrollLabScenes: StoryScrollScene<MotionLabSceneData>[] = [
  {
    id: "autoscroll-lab-briefing",
    title: "Briefing opens",
    eyebrow: "Auto 01",
    data: {
      accent: "#5ac8a8",
      deck: "Autoscroll starts the reader in a stable scene while the progress value drives the image crop and lower meter.",
      imageAlt: "A desk covered with notes, charts, and a laptop",
      imageSrc:
        "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
      metricLabel: "Pace",
      metricValue: "12/s",
      readouts: [
        { label: "Mode", value: "Auto" },
        { label: "Input", value: "0.5x" },
        { label: "Fade", value: "14" },
      ],
    },
    render: (props) => <MotionLabScene {...props} />,
  },
  {
    id: "autoscroll-lab-evidence",
    title: "Evidence passes",
    eyebrow: "Auto 02",
    data: {
      accent: "#f1b851",
      deck: "Longer copy can stay readable because the scroll pace is defined in normalized scene units instead of pixels.",
      imageAlt: "Printed photographs arranged on a light table",
      imageSrc:
        "https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=1400&q=80",
      metricLabel: "Read",
      metricValue: "68%",
      readouts: [
        { label: "Segment", value: "2/4" },
        { label: "Motion", value: "Safe" },
        { label: "Manual", value: "Wheel" },
      ],
    },
    render: (props) => <MotionLabScene {...props} />,
  },
  {
    id: "autoscroll-lab-handoff",
    title: "Handoff fades",
    eyebrow: "Auto 03",
    data: {
      accent: "#ef8b72",
      deck: "Fade presets show how autoplay can move through boundaries without asking the reader to touch the wheel.",
      imageAlt: "A train platform with passengers in morning light",
      imageSrc:
        "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1400&q=80",
      metricLabel: "Handoff",
      metricValue: "Live",
      readouts: [
        { label: "Next", value: "Queued" },
        { label: "Units", value: "26" },
        { label: "State", value: "Active" },
      ],
    },
    render: (props) => <MotionLabScene {...props} />,
  },
  {
    id: "autoscroll-lab-ending",
    title: "Ending holds",
    eyebrow: "Auto 04",
    transitionToNext: { type: "none" },
    data: {
      accent: "#7ab8ff",
      deck: "The interval stops at the end of the scroll range, leaving the final scene available for review.",
      imageAlt: "A newspaper and coffee cup on a cafe table",
      imageSrc:
        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1400&q=80",
      metricLabel: "End",
      metricValue: "Hold",
      readouts: [
        { label: "Loop", value: "No" },
        { label: "Reduced", value: "Stops" },
        { label: "Review", value: "Ready" },
      ],
    },
    render: (props) => <MotionLabScene {...props} />,
  },
];

function SignalStage({ node, progress, currentIndex }: StoryRenderProps<SignalStoryData>) {
  const data = node.data;

  return (
    <section className={`demo-stage demo-stage-${data?.tone ?? "cyan"}`}>
      {data ? <img className="demo-stage-image" src={data.imageSrc} alt={data.imageAlt} /> : null}
      <div className="demo-stage-scrim" />
      <div className="demo-stage-grid" aria-hidden="true" />

      <div className="demo-stage-content">
        <div className="demo-stage-copy">
          {node.eyebrow ? <p className="demo-stage-eyebrow">{node.eyebrow}</p> : null}
          <h2>{node.title}</h2>
          <StoryContent content={node.content} className="demo-stage-body" />
        </div>

        <dl className="demo-stage-instrument">
          <div>
            <dt>Scene</dt>
            <dd>{String(currentIndex + 1).padStart(2, "0")}</dd>
          </div>
          {data ? (
            <>
              <div>
                <dt>{data.metricLabel}</dt>
                <dd>{data.metricValue}</dd>
              </div>
              <div>
                <dt>Channel</dt>
                <dd>{data.channel}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{data.location}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>

      <div className="demo-stage-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(progress * 100, 12)}%` }} />
      </div>
    </section>
  );
}

function MotionLabScene({
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
      className="motion-lab-scene"
      style={{ "--motion-accent": data?.accent ?? "#56d5c4" } as CSSProperties}
    >
      {data ? (
        <motion.img
          className="motion-lab-image"
          src={data.imageSrc}
          alt={data.imageAlt}
          style={{ scale: imageScale, y: imageY }}
        />
      ) : null}
      <div className="motion-lab-scrim" />
      <div className="motion-lab-scan" aria-hidden="true" />

      <motion.div className="motion-lab-copy" style={{ opacity: copyOpacity, y: copyY }}>
        {scene.eyebrow ? <p className="motion-lab-eyebrow">{scene.eyebrow}</p> : null}
        <h2>{scene.title}</h2>
        {data ? <p>{data.deck}</p> : null}
      </motion.div>

      <motion.div className="motion-lab-instrument" style={{ y: instrumentY }}>
        <div className="motion-lab-instrument-header">
          <span>{String(sceneIndex + 1).padStart(2, "0")}</span>
          <span>{String(sceneCount).padStart(2, "0")}</span>
        </div>
        {data ? (
          <div className="motion-lab-primary-readout">
            <span>{data.metricLabel}</span>
            <strong>{data.metricValue}</strong>
          </div>
        ) : null}
        <ul>
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

      <div className="motion-lab-meter" aria-hidden="true">
        <motion.span style={{ scaleX: meterScale }} />
      </div>
      <span className="motion-lab-value" aria-hidden="true">
        {Math.round(progress * 100)
          .toString()
          .padStart(2, "0")}
      </span>
      <span className="motion-lab-active" data-active={isActive ? "true" : "false"} />
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
    <motion.li style={{ opacity, y }}>
      <span>{readout.label}</span>
      <strong>{readout.value}</strong>
    </motion.li>
  );
}
