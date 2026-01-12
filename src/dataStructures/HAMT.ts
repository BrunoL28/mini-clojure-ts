/* eslint-disable @typescript-eslint/no-unused-vars */
import { hash } from "../core/Hash.js";
import { equals } from "../core/Runtime.js";

const SHIFT = 5;
const SIZE = 32;
const MASK = 0x01f;

function mask(hash: number, shift: number): number {
    return (hash >>> shift) & MASK;
}

function bitpos(hash: number, shift: number): number {
    return 1 << mask(hash, shift);
}

function popcount(n: number): number {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function index(bitmap: number, bit: number): number {
    return popcount(bitmap & (bit - 1));
}

export interface Node {
    assoc(shift: number, hash: number, key: any, val: any): Node;
    find(shift: number, hash: number, key: any): any;
    without(shift: number, hash: number, key: any): Node | null;
    entries(acc: [any, any][]): void;
}

class ValueNode implements Node {
    constructor(
        public readonly hash: number,
        public readonly key: any,
        public readonly val: any,
    ) {}

    assoc(shift: number, hash: number, key: any, val: any): Node {
        if (this.hash === hash && equals(this.key, key)) {
            if (this.val === val) return this;
            return new ValueNode(hash, key, val);
        }
        if (this.hash === hash) {
            return new CollisionNode(hash, [
                this,
                new ValueNode(hash, key, val),
            ]);
        }
        return mergeTwo(shift, this, new ValueNode(hash, key, val));
    }

    find(shift: number, hash: number, key: any): any {
        if (this.hash === hash && equals(this.key, key)) return this.val;
        return undefined;
    }

    without(shift: number, hash: number, key: any): Node | null {
        if (this.hash === hash && equals(this.key, key)) return null;
        return this;
    }

    entries(acc: [any, any][]): void {
        acc.push([this.key, this.val]);
    }
}

class CollisionNode implements Node {
    constructor(
        public readonly hash: number,
        public readonly children: ValueNode[],
    ) {}

    assoc(shift: number, hash: number, key: any, val: any): Node {
        if (hash !== this.hash) {
            return mergeTwo(shift, this, new ValueNode(hash, key, val));
        }
        const idx = this.children.findIndex((c) => equals(c.key, key));
        const newChildren = [...this.children];
        if (idx !== -1) {
            newChildren[idx] = new ValueNode(hash, key, val);
        } else {
            newChildren.push(new ValueNode(hash, key, val));
        }
        return new CollisionNode(hash, newChildren);
    }

    find(shift: number, hash: number, key: any): any {
        if (hash !== this.hash) return undefined;
        const node = this.children.find((c) => equals(c.key, key));
        return node ? node.val : undefined;
    }

    without(shift: number, hash: number, key: any): Node | null {
        if (hash !== this.hash) return this;
        const idx = this.children.findIndex((c) => equals(c.key, key));
        if (idx === -1) return this;

        if (this.children.length === 2) {
            return idx === 0 ? this.children[1]! : this.children[0]!;
        }

        const newChildren = this.children.filter((_, i) => i !== idx);
        return new CollisionNode(hash, newChildren);
    }

    entries(acc: [any, any][]): void {
        this.children.forEach((c) => c.entries(acc));
    }
}

class BitmapIndexedNode implements Node {
    constructor(
        public readonly bitmap: number,
        public readonly array: Node[],
    ) {}

    assoc(shift: number, hash: number, key: any, val: any): Node {
        const bit = bitpos(hash, shift);
        const idx = index(this.bitmap, bit);

        if ((this.bitmap & bit) !== 0) {
            const child = this.array[idx];
            const newChild = child!.assoc(shift + 5, hash, key, val);
            if (child === newChild) return this;

            const newArray = [...this.array];
            newArray[idx] = newChild;
            return new BitmapIndexedNode(this.bitmap, newArray);
        } else {
            const newChild = new ValueNode(hash, key, val);
            const newArray = [...this.array];
            newArray.splice(idx, 0, newChild);
            return new BitmapIndexedNode(this.bitmap | bit, newArray);
        }
    }

    find(shift: number, hash: number, key: any): any {
        const bit = bitpos(hash, shift);
        if ((this.bitmap & bit) === 0) return undefined;
        const idx = index(this.bitmap, bit);
        return this.array[idx]!.find(shift + 5, hash, key);
    }

    without(shift: number, hash: number, key: any): Node | null {
        const bit = bitpos(hash, shift);
        if ((this.bitmap & bit) === 0) return this;
        const idx = index(this.bitmap, bit);
        const child = this.array[idx];
        const newChild = child!.without(shift + 5, hash, key);

        if (newChild === child) return this;

        if (newChild === null) {
            if (this.bitmap === bit) return null;
            const newArray = [...this.array];
            newArray.splice(idx, 1);
            return new BitmapIndexedNode(this.bitmap ^ bit, newArray);
        }

        const newArray = [...this.array];
        newArray[idx] = newChild;
        return new BitmapIndexedNode(this.bitmap, newArray);
    }

    entries(acc: [any, any][]): void {
        this.array.forEach((n) => n.entries(acc));
    }
}

function mergeTwo(shift: number, node1: Node, node2: ValueNode): Node {
    const h1 = (node1 as any).hash;
    const h2 = node2.hash;

    if (h1 === h2) {
        return new CollisionNode(h1, [node1 as ValueNode, node2]);
    }

    const mask1 = mask(h1, shift);
    const mask2 = mask(h2, shift);

    if (mask1 === mask2) {
        const next = mergeTwo(shift + 5, node1, node2);
        const bit = 1 << mask1;
        return new BitmapIndexedNode(bit, [next]);
    }

    const bit1 = 1 << mask1;
    const bit2 = 1 << mask2;
    const children = mask1 < mask2 ? [node1, node2] : [node2, node1];
    return new BitmapIndexedNode(bit1 | bit2, children);
}

export class HAMT {
    constructor(
        private root: Node | null = null,
        public size: number = 0,
    ) {}

    set(key: any, val: any): HAMT {
        const h = hash(key);
        const newRoot = this.root
            ? this.root.assoc(0, h, key, val)
            : new ValueNode(h, key, val);

        const exists = this.get(key) !== undefined;
        return new HAMT(newRoot, exists ? this.size : this.size + 1);
    }

    get(key: any): any {
        if (!this.root) return undefined;
        return this.root.find(0, hash(key), key);
    }

    has(key: any): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: any): HAMT {
        if (!this.root) return this;
        if (!this.has(key)) return this;
        const newRoot = this.root.without(0, hash(key), key);
        return new HAMT(newRoot, this.size - 1);
    }

    *[Symbol.iterator](): Iterator<[any, any]> {
        if (!this.root) return;
        const acc: [any, any][] = [];
        this.root.entries(acc);
        for (const entry of acc) yield entry;
    }

    entries(): [any, any][] {
        const acc: [any, any][] = [];
        if (this.root) this.root.entries(acc);
        return acc;
    }
}
