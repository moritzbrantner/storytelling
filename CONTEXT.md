# Storytelling

The storytelling context defines portable story data, traversal state, and renderer vocabulary for branching narrative experiences.

## Language

**StoryDocument**:
A valid, published, JSON-serializable story description.
_Avoid_: StoryDefinition, hybrid story object

**StoryDraft**:
An editor-held, incomplete or invalid JSON story shape used before publication.
_Avoid_: invalid StoryDocument

**StoryNode**:
A playable scene or decision point in a story.

**Child Node**:
A nested playable node that participates in ordered depth-first playback under its parent.
_Avoid_: visual group

**StoryChoice**:
A selectable transition from one node to another.

**StorySnapshot**:
A JSON-serializable resumable runtime value containing the current node, visit history, runtime state, and stop reason.

**StoryPath**:
The resolved traversal through a story for a snapshot or selected route.

**StoryStateHooks**:
The executable behavior layer supplied beside a document.

**Renderer Key**:
A semantic stage identifier in the document that target-specific registries implement for web, Remotion, or Three.
