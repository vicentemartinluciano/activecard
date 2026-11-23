import React from "react";
import { Text } from "react-native";
import { act, create } from "react-test-renderer";
import {
  __resetStudySoundsForTest,
  isStudySoundsEnabled,
  playStudySound,
  registerStudySoundBridge,
  setStudySoundsEnabled,
} from "../../lib/studySounds";
import { playSynthSound, SOUND_KINDS } from "../../lib/studySoundScript";
import ProgressBar from "../ProgressBar";
import Stagger, { useStaggerKey } from "../Stagger";

jest.mock("react-native", () => {
  const react = require("react");
  class AnimatedValue {
    constructor(val) {
      this.val = val;
    }
    setValue(v) {
      this.val = v;
    }
    stopAnimation() {}
    interpolate(config) {
      return { input: this.val, ...config };
    }
  }
  return {
    Platform: { OS: "android", select: (values) => values.android ?? values.default },
    StyleSheet: { create: (styles) => styles },
    Easing: { out: (fn) => fn, cubic: (t) => t },
    Animated: {
      Value: AnimatedValue,
      View: ({ children, ...props }) => react.createElement("AnimatedView", props, children),
      timing: (val, { toValue }) => ({
        start: (cb) => {
          val.setValue(toValue);
          cb?.({ finished: true });
        },
        stop: () => {},
      }),
    },
    View: ({ children, ...props }) => react.createElement("View", props, children),
    Text: ({ children, ...props }) => react.createElement("Text", props, children),
  };
});

jest.mock("expo-linear-gradient", () => {
  const react = require("react");
  return {
    LinearGradient: ({ children, ...props }) => react.createElement("LinearGradient", props, children),
  };
});

jest.mock("../../db/settings", () => ({
  getSetting: jest.fn().mockResolvedValue(true),
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

describe("Fluidez (Stagger + ProgressBar) y sonidos de estudio", () => {
  beforeEach(() => {
    __resetStudySoundsForTest();
  });

  test("Stagger no trunca a 8 elementos y useStaggerKey se mantiene estable", () => {
    expect(useStaggerKey()).toBe(0);
    const items = Array.from({ length: 12 }, (_, idx) => <Text key={idx}>{`Item ${idx}`}</Text>);
    let tree;
    try {
      act(() => {
        tree = create(<Stagger>{items}</Stagger>);
      });
      expect(tree.root.findAllByType(Text)).toHaveLength(12);
    } finally {
      act(() => tree?.unmount());
    }
  });

  test("ProgressBar oculta relleno en 0/NaN/negativos, clampa >100 y mide ancho sin glitch", async () => {
    let empty;
    let nanBar;
    let negBar;
    let overBar;
    let live;
    try {
      await act(async () => {
        empty = create(<ProgressBar pct={0} />);
        nanBar = create(<ProgressBar pct={Number.NaN} />);
        negBar = create(<ProgressBar pct={-15} />);
        overBar = create(<ProgressBar pct={150} animated={false} />);
        live = create(<ProgressBar pct={25} animated={false} />);
      });
      expect(empty.root.findAllByType("View")).toHaveLength(1);
      expect(nanBar.root.findAllByType("View")).toHaveLength(1);
      expect(negBar.root.findAllByType("View")).toHaveLength(1);
      expect(nanBar.root.findAllByType("AnimatedView")).toHaveLength(0);
      expect(JSON.stringify(negBar.toJSON())).not.toContain("-15%");
      expect(JSON.stringify(overBar.toJSON())).toContain("100%");

      const track = live.root.find((node) => typeof node.props?.onLayout === "function");
      await act(async () => {
        track.props.onLayout({ nativeEvent: { layout: { width: 200 } } });
      });
      await act(async () => {
        live.update(<ProgressBar pct={60} animated={false} />);
      });
      expect(JSON.stringify(live.toJSON())).toContain("scaleX");
    } finally {
      await act(async () => {
        empty?.unmount();
        nanBar?.unmount();
        negBar?.unmount();
        overBar?.unmount();
        live?.unmount();
      });
    }
  });

  test("playSynthSound usa tonos cálidos y playStudySound respeta mute o force", async () => {
    const recordedFreqs = [];
    const mockCtx = {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({
        type: "sine",
        frequency: {
          setValueAtTime: (f) => recordedFreqs.push(f),
          exponentialRampToValueAtTime: (f) => recordedFreqs.push(f),
        },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      }),
      createGain: () => ({
        gain: {
          setValueAtTime: jest.fn(),
          linearRampToValueAtTime: jest.fn(),
          exponentialRampToValueAtTime: jest.fn(),
        },
        connect: jest.fn(),
      }),
    };

    for (const kind of SOUND_KINDS) {
      expect(playSynthSound(mockCtx, kind)).toBe(true);
    }
    expect(recordedFreqs.length).toBeGreaterThan(0);
    expect(Math.max(...recordedFreqs)).toBeLessThanOrEqual(600);

    const bridge = jest.fn();
    const unregister = registerStudySoundBridge(bridge);
    await setStudySoundsEnabled(false);
    expect(isStudySoundsEnabled()).toBe(false);
    expect(playStudySound("good")).toBe(false);
    expect(bridge).not.toHaveBeenCalled();

    expect(playStudySound("good", { force: true })).toBe(true);
    expect(bridge).toHaveBeenCalledWith("good");
    unregister();
  });
});
