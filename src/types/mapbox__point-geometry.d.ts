declare module 'mapbox__point-geometry' {
    export default class Point {
        x: number;
        y: number;
        constructor(x: number, y: number);
        clone(): Point;
        add(p: Point): Point;
        sub(p: Point): Point;
        multByPoint(p: Point): Point;
        divByPoint(p: Point): Point;
        mult(k: number): Point;
        div(k: number): Point;
        rotate(a: number): Point;
        rotateAround(a: number, p: Point): Point;
        matMult(m: number[]): Point;
        unit(): Point;
        perp(): Point;
        round(): Point;
        mag(): number;
        equals(p: Point): boolean;
        dist(p: Point): number;
        distSqr(p: Point): number;
        angle(): number;
        angleTo(b: Point): number;
        angleWith(b: Point): number;
        angleWithSep(x: number, y: number): number;
        static convert(a: any): Point;
    }
}
