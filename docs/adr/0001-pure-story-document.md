# Pure Story Documents

`StoryDocument` is pure JSON data, executable behavior lives in `StoryStateHooks`, strict validation is the default published-story contract, and deprecated choice-id compatibility APIs are removed before v1. This is a breaking cleanup, but dependent projects are controlled by us, so stabilizing the core story model now is cheaper than preserving hybrid document semantics.
