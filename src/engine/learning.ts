/**
 * Learning engine — Milestone A scope: simple shuffled queue + wrong queue.
 * Milestone C replaces this with spaced repetition, mastery states, and
 * bookmarks. Keep the surface stable so the swap is drop-in.
 */

import type { JoinedQuestion } from '../data/types'

export interface QuestionQueue {
  next(): JoinedQuestion | undefined
  peek(): JoinedQuestion | undefined
  remaining(): number
  total(): number
  position(): number
}

class ArrayQueue implements QuestionQueue {
  private i = 0
  constructor(private readonly items: readonly JoinedQuestion[]) {}
  next() {
    const q = this.items[this.i]
    if (q) this.i++
    return q
  }
  peek() {
    return this.items[this.i]
  }
  remaining() {
    return this.items.length - this.i
  }
  total() {
    return this.items.length
  }
  position() {
    return this.i
  }
}

export function learnQueue(
  all: readonly JoinedQuestion[],
  rng: () => number = Math.random,
): QuestionQueue {
  const copy = all.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return new ArrayQueue(copy)
}

export function bilgeQueue(
  all: readonly JoinedQuestion[],
  wrongIds: readonly number[],
): QuestionQueue {
  const set = new Set(wrongIds)
  return new ArrayQueue(all.filter((q) => set.has(q.id)))
}
