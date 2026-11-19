import assert from "node:assert/strict";
import test from "node:test";
import { mergeList, mergeSpaces } from "../lib/space-merge.ts";

const story = (id, title) => ({ id, title });

test("a story added here and a thought accepted on the other device both survive", () => {
  const base = { storyLibrary: [story("a", "A")], revisions: [] };
  const local = { storyLibrary: [story("a", "A"), story("b", "B")], revisions: [] };
  const cloud = { storyLibrary: [story("a", "A")], revisions: [{ id: 7, revised: "新念头" }] };
  const merged = mergeSpaces(base, local, cloud);
  assert.deepEqual(merged.storyLibrary.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(merged.revisions.map((item) => item.id), [7]);
});

test("a deletion on either side sticks", () => {
  const base = [story("a", "A"), story("b", "B"), story("c", "C")];
  const local = [story("a", "A"), story("c", "C")]; // b deleted here
  const cloud = [story("a", "A"), story("b", "B")]; // c deleted there
  assert.deepEqual(mergeList(base, local, cloud).map((item) => item.id), ["a"]);
});

test("an edit beats a deletion of the same record", () => {
  const base = [story("a", "A")];
  const local = [story("a", "A edited")];
  const cloud = [];
  assert.deepEqual(mergeList(base, local, cloud), [story("a", "A edited")]);
});

test("the side that changed a record wins; this device wins when both did", () => {
  const base = [story("a", "A"), story("b", "B")];
  const local = [story("a", "A here"), story("b", "B")];
  const cloud = [story("a", "A there"), story("b", "B there")];
  assert.deepEqual(mergeList(base, local, cloud), [story("a", "A here"), story("b", "B there")]);
});

test("records only the cloud has keep their place next to their neighbour", () => {
  const base = [{ id: 1 }, { id: 3 }];
  const local = [{ id: 1 }, { id: 3 }, { id: 4 }];
  const cloud = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(mergeList(base, local, cloud).map((item) => item.id), [1, 2, 3, 4]);
});

test("without an agreed copy nothing is dropped and the cloud wins shared records", () => {
  const local = [story("a", "A here"), story("b", "B")];
  const cloud = [story("a", "A there"), story("c", "C")];
  assert.deepEqual(mergeList(null, local, cloud), [story("a", "A there"), story("b", "B"), story("c", "C")]);
});

test("goal fields merge one by one, but two different desires are never mixed", () => {
  const base = { goal: { id: "g", desire: "旧", beliefs: ["x"] } };
  const local = { goal: { id: "g", desire: "新", beliefs: ["x"] } };
  const cloud = { goal: { id: "g", desire: "旧", beliefs: [] } };
  assert.deepEqual(mergeSpaces(base, local, cloud).goal, { id: "g", desire: "新", beliefs: [] });

  const switched = { goal: { id: "h", desire: "另一个愿望" } };
  assert.deepEqual(mergeSpaces(base, local, switched).goal, switched.goal);
});

test("messages merge only inside the same conversation", () => {
  const base = { conversationId: "c1", messages: [{ id: "m1" }] };
  const local = { conversationId: "c1", messages: [{ id: "m1" }, { id: "m2" }] };
  const cloud = { conversationId: "c1", messages: [{ id: "m1" }, { id: "m3" }] };
  assert.deepEqual(mergeSpaces(base, local, cloud).messages.map((item) => item.id), ["m1", "m2", "m3"]);

  const other = { conversationId: "c2", messages: [{ id: "x" }] };
  const merged = mergeSpaces(base, { conversationId: "c1", messages: [{ id: "m1" }] }, other);
  assert.equal(merged.conversationId, "c2");
  assert.deepEqual(merged.messages, [{ id: "x" }]);
});
