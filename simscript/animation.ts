import { Simulation } from './simulation';
import { Queue } from './queue';
import { Entity } from './entity';
import { assert, setOptions, getElement } from './util';

const _DEFAULT_ENTITY_ICON = '&#9899;'; // black circle
const _DEFAULT_SPLINE_TENSION = 0.1;

// included by a-frame
declare var THREE: any;

/**
 * Defines animation parameters for {@link Queue} objects.
 */
export interface IAnimatedQueue {
    /**
     * {@link Queue} to animate.
     */
    queue: Queue,
    /**
     * Element that represents the {@see Queue} in the document.
     */
    element: string | Element,
    /**
     * The {@link Queue} angle, in degrees, measured in clockwise 
     * direction from the nine o'clock position.
     */
    angle?: number,
    /**
     * The maximum number of entities to display in the {@link Queue}.
     */
    max?: number
}

/**
 * Defines the elements that describe a specific position along a spline.
 * @internal
 */
interface ISplinePosition {
    /** Point along the spline. */
    point: Point,
    /** Tangent of the spline at the point. */
    angle: number
}

/**
 * Class used to add animations to {@link Simulation} objects.
 * 
 * The {@link Animation} class adds animations to existing
 * {@link Simulation} objects. 
 * 
 * The animations are shown in a host element defined in the
 * constructor. The host element can be regular **div** or
 * **svg** elements.
 * 
 * Animations hosted in **div** elements use absolutely positioned
 * elements (often **img**) to represent entities.
 * 
 * Animations hosted in **svg** elements use SVG (often *g*)
 * elements to represent entities.
 * 
 * {@link Queue} positions are defined by elements in the animation
 * host element, as specified by the {@link queues} property.
 * 
 * {@link Entity} objects are represented by HTML elements defined
 * by the {@link getEntityHtml} function.
 * 
 * Entities are shown while in animated queues
 * (see the {@link Entity.enterQueue} method) and while in transit 
 * between animated queues (see the {@link Entity.move} method).
 */
export class Animation {
    private _sim: Simulation;
    private _host: Element;
    private _width: number;
    private _height: number;
    private _queues = new Map<Queue, AnimatedQueue>();
    private _queueArray: IAnimatedQueue[];
    private _rotateEntities = false;
    private _toQueueEnd = true;
    private _getEntityHtml: Function;
    /** @internal */ _entities = new Map<Entity, AnimatedEntity>();
    /** @internal */ _lastUpdate: number;
    
    /**
     * Initializes a new instance of the {@link Animation} class.
     * 
     * @param sim {@link Simulation} that drives this animation.
     * @param animationHost HTML element that hosts this animation.
     * @param options Object with parameters used to initialize the animation.
     */
    constructor(sim: Simulation, animationHost: any, options?: any) {

        // host element
        this._host = getElement(animationHost);

        // simulation
        this._sim = sim;
        this._sim.timeNowChanged.addEventListener(this._timeNowChanged, this);

        // slow down the simulation to keep the animation smooth
        sim.yieldInterval = 15; // about 60 fps

        // internal stuff
        this._lastUpdate = 0;
        this._entities = new Map<Entity, AnimatedEntity>();

        // options
        if (options) {
            setOptions(this, options);
        }
    }
    
    /**
     * Gets a reference to the animation's host element.
     */
    get hostElement(): Element {
        return this._host;
    }
    /**
     * Gets a value that indicates whether the animation's 
     * host element is an SVG element.
     */
    get isSvg(): boolean {
        return this._host instanceof SVGElement;
    }
    /**
     * Gets a value that indicates whether the animation's 
     * host element is an A-Frame scene.
     */
     get isAFrame(): boolean {
        return this._host.tagName == 'A-SCENE';
    }
    /**
     * Gets or sets a function that returns the HTML to be used
     * to create elements that represent the animated entity.
     */
    get getEntityHtml(): Function {
        return this._getEntityHtml;
    }
    set getEntityHtml(value: Function) {
        this._getEntityHtml = value;
    }
    /**
     * Gets or sets a value that determines whether entities should 
     * be rotated when in queues or in transit.
     * 
     * The default value for this property is **false**, which causes
     * entities to be displayed without any rotation.
     */
    get rotateEntities(): boolean {
        return this._rotateEntities;
    }
    set rotateEntities(value: boolean) {
        this._rotateEntities = value;
    }
    /**
     * Gets or sets a value that determines whether entities should 
     * move towards the end or start of the destination queue.
     * 
     * The default value for this property is **true**, which causes
     * entities to move towards the end of the destination queue.
     */
    get animateToQueueEnd(): boolean {
        return this._toQueueEnd;
    }
    set animateToQueueEnd(value: boolean) {
        this._toQueueEnd = value;
    }
    /**
     * Gets or sets an array with queue animation information.
     * 
     * The items in the array should implement the {@link IAnimatedQueue} interface,
     */
    get queues(): IAnimatedQueue[] {
        return this._queueArray;
    }
    set queues(value: IAnimatedQueue[]) {
        this._queueArray = value;
        value.forEach(item => {
            let aq = new AnimatedQueue(this, item);
            this._queues.set(aq._q, aq);
        });
    }

    // ** implementation

    // updates entities in transit and in animated queues
    protected _timeNowChanged() {

        // reset queue start positions
        const host = this._host;
        const sim = this._sim;
        const rc = host.getBoundingClientRect();
        if (rc.height != this._height || rc.width != this._width) {
            this._height = rc.height;
            this._width = rc.width;
            for (let aq of this._queues.values()) {
                aq._ptStart = null;
            }
        }

        // prepare to remove unused animation entities
        this._entities.forEach(ae => {
            ae._inUse = false;
        });

        // draw entities in animated queues
        for (let aq of this._queues.values()) {
            aq._draw();
        }

        // draw entities in transit between animated queues
        sim._fec.forEach(item => {

            // see if this entity is in transit between two animated queues
            if (item.options.path && item.timeDue != null) {

                // get AnimatedEntity for this entity
                const ae = this._getAnimatedEntity(item.e);

                // calculate path
                const path = item.options.path;
                const tension = path.tension != null ? path.tension : _DEFAULT_SPLINE_TENSION;
                const points: Point[] = [];
                path.queues.forEach((q, index) => {
                    const aq = this._queues.get(q);
                    assert(aq != null, 'Queue missing animation info');
                    points.push(this._toQueueEnd && path.queues.length == 2 && index > 0
                        ? aq._ptEnd || aq._getStart()
                        : aq._getStart());
                });

                // update entity position
                let start = item.timeStart,
                    finish = item.timeDue,
                    pct = 1 - (finish - this._sim.timeNow) / (finish - start),
                    splinePos = getSplinePosition(points, tension, pct);
                ae._drawAt(splinePos.point, this.rotateEntities ? splinePos.angle : 0);
            }
        });

        // remember time of last update
        this._lastUpdate = sim.timeNow;

        // remove elements that are not currently in use
        this._entities.forEach((ae, key) => {
            if (!ae._inUse) {
                this._entities.delete(key);
                let e = ae._element;
                if (e && e.parentElement) {
                    e.parentElement.removeChild(e);
                }
            }
        });
    }

    // gets/creates an AnimatedEntity for a regular entity
    /** @internal */ _getAnimatedEntity(e: Entity): AnimatedEntity {
        let ae = this._entities.get(e);
        if (!ae) {
            ae = new AnimatedEntity(this, e);
            this._entities.set(e, ae);
        }
        return ae;
    }
}

/**
 * Represents a queue in the animation.
 */
class AnimatedQueue {
    _anim: Animation;
    _element: Element;
    _q: Queue;
    _max: number;
    _angle = 0;
    _sin = 0;
    _cos = 1;
    _ptStart: Point;
    _ptEnd: Point;

    // ctor
    constructor(anim: Animation, options: IAnimatedQueue) {
        this._anim = anim;
        this._q = options.queue;
        this._element = getElement(options.element);
        this._angle = options.angle || 0;
        this._max = options.max;
        const angle = this._angle / 180 * Math.PI;
        this._sin = Math.sin(-angle);
        this._cos = -Math.cos(-angle);
        assert(this._q instanceof Queue, 'q parameter should be a Queue');
    }

    // gets the position of the queue start in DOM coordinates.
    _getStart(): Point {
        if (!this._ptStart) {
            const e = this._element;
            const anim = this._anim;
            if (anim.isSvg) {
                const rc = (e as any).getBBox();
                this._ptStart = new Point(
                    rc.x + rc.width / 2,
                    rc.y + rc.height / 2,
                    0
                );
            } else if (anim.isAFrame) {
                const pt = (e as any).object3D.position;
                this._ptStart = new Point(pt.x, pt.y, pt.z);
            } else {
                const rcHost = anim.hostElement.getBoundingClientRect();
                const rc = e.getBoundingClientRect();
                this._ptStart = new Point(
                    rc.left - rcHost.left + rc.width / 2,
                    rc.top - rcHost.top + rc.height / 2,
                    0
                );
            }
        }
        return this._ptStart;
    }

    // draws the entities in this animation queue.
    _draw() {

        // skip this if we're up-to-date
        let anim = this._anim;
        if (this._q.lastChange < anim._lastUpdate) {
            for (let item of this._q.items.values()) {
                let ae = anim._entities.get(item.entity);
                if (ae) {
                    ae._inUse = true;
                }
            }
            return;
        }

        // initialize insert position
        let pt = this._getStart().clone();
        this._ptEnd = null;

        // loop through entities in the queue
        let cnt = 0;
        for (let item of this._q.items.values()) {

            // honor max numer of entities to display
            if (this._max != null && cnt >= this._max) {
                break;
            }

            // get entity
            const e = item.entity;

            // get/create AnimatedEntity for this entity
            const ae = anim._getAnimatedEntity(e);
            const halfWid = ae._width * this._cos / 2;
            const halfHei = (anim.rotateEntities ? ae._width : ae._height) * this._sin / 2;

            // update entity position and insertion point position
            pt.x += halfWid;
            pt.y += halfHei;
            ae._drawAt(pt, this._angle);
            pt.x += halfWid;
            pt.y += halfHei;

            // keep track of entity count
            cnt++;
        }

        // store queue end
        this._ptEnd = pt;
    }
}

/**
 * Represents an entity in the animation.
 */
class AnimatedEntity {
    _anim: Animation;
    _entity: Entity;
    _element: Element;
    _width: number;
    _height: number;
    _depth: number;
    _inUse: boolean;

    // ctor
    constructor(anim: Animation, entity: Entity) {
        this._anim = anim;
        this._entity = entity;
        this._inUse = false;

        // create animation element 
        const e = anim.isSvg ? document.createElementNS('http://www.w3.org/2000/svg', 'g') :
            anim.isAFrame ? document.createElement('a-entity') :
            document.createElement('div');
        e.innerHTML = this._getEntityHtml();
        (e as any).style.opacity = '0';
        e.classList.add('ss-entity');
        this._element = e;

        // append animation element to host
        anim.hostElement.appendChild(e);

        // measure element
        if (anim.isAFrame) {
            this._width = this._height = this._depth = 0;
            requestAnimationFrame(() => {
                const model = (e as any).object3D;
                //const helper = new THREE.BoxHelper(model);
                //helper.geometry.computeBoundingBox();
                //console.log(helper.geometry.boundingBox);
                const box = new THREE.Box3().setFromObject(model);
                this._width = box.max.x - box.min.x;
                this._height = box.max.y - box.min.y;
                this._depth = box.max.z - box.min.z;
            });
        } else {
            const rc = anim.isSvg
                ? (e as any).getBBox()
                : e.getBoundingClientRect();
            this._width = rc.width;
            this._height = rc.height;
            this._depth = 0;
        }
    }

    // gets the inner HTML for this entity's element
    _getEntityHtml() {
        let getEntity = this._anim.getEntityHtml;
        return getEntity
            ? getEntity(this._entity)
            : _DEFAULT_ENTITY_ICON;
    }

    // sets the position of this animated entity.
    _drawAt(pt: Point, angle?: number) {
        const anim = this._anim;
        const e = this._element;
        const s = (e as any).style;

        // update the entity element
        if (anim.isAFrame) {

            // set a-frame entity attributes
            e.setAttribute('position', `${Math.round(pt.x)} ${Math.round(pt.y)} ${Math.round(pt.z)}`);
            if (angle && anim.rotateEntities) {
                e.setAttribute('rotation', `0 0 ${angle}`);
            }

        } else {

            // adjust reference point (middle of the element)
            const p = new Point(pt.x - this._width / 2, pt.y - this._height / 2, pt.z);

            // calculate the transform
            let transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
            if (angle && anim.rotateEntities) {
                transform += ` rotate(${angle}deg)`;
            }

            // and apply it
            s.transform = transform;
            s.opacity = '';
        }

        // remember we're in use
        this._inUse = true;
    }
}

/**
 * Represents a point with x and y coordinates.
 */
class Point {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    clone() {
        return new Point(this.x, this.y, this.z);
    }

    static distance(p1: Point, p2: Point): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z - p2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz)
    }
    static interpolate(p1: Point, p2: Point, pct: number): Point {
        return new Point(
            p1.x + (p2.x - p1.x) * pct,
            p1.y + (p2.y - p1.y) * pct,
            p1.z + (p2.z - p1.z) * pct
        )
    }
}

/**
 * Gets a position along a spline defined by a vector of control points and a tension.
 * 
 * @param pts Vector of points that define the spline.
 * @param tension Spline tension (zero means each segment is a straight line, 0.5 creates wide curves).
 * @param pct Position within the spline as a percentage (zero means first point, one means last point).
 * 
 * @returns The point along the spline at the given percentage.
 */
function getSplinePosition(pts: Point[], tension: number, pct: number): ISplinePosition {

    // just two points? use linear interpolation 
    if (pts.length == 2) {
        return {
            point: Point.interpolate(pts[0], pts[1], pct),
            angle: getAngle(pts[0], pts[1])
        }
    }

    // calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        totalDistance += Point.distance(pts[i], pts[i + 1]);
    }

    // calculate position within the spline
    let position = totalDistance * pct;

    // calculate index of spline segment
    let index = 0;
    let distance = 0;
    let length = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        length = Point.distance(pts[i], pts[i + 1]);
        if (distance + length >= position) {
            index = i;
            break;
        }
        distance += length;
    }

    // calculate percentage traveled within the current segment
    position -= distance;
    pct = position / length;
    assert(pct >= 0 && pct <= 1.0000001, 'position percentage out of range');

    // interpolate position
    if (index == 0) { // first segment
        return _getSplinePosition(pts[0], pts[0], pts[1], pts[2], tension, pct);
    } else if (index == pts.length - 2) { // last segment
        return _getSplinePosition(pts[index - 1], pts[index], pts[index + 1], pts[index + 1], tension, pct);
    } else { // intermediate segment
        return _getSplinePosition(pts[index - 1], pts[index], pts[index + 1], pts[index + 2], tension, pct);
    }
}

// See 
// Petzold, "Programming Microsoft Windows with C#", pages 645-646 or
function _getSplinePosition(p0: Point, p1: Point, p2: Point, p3: Point, tension: number, pct: number): ISplinePosition {
    const sx1 = tension * (p2.x - p0.x);
    const sy1 = tension * (p2.y - p0.y);
    const sz1 = tension * (p2.z - p0.z);

    const sx2 = tension * (p3.x - p1.x);
    const sy2 = tension * (p3.y - p1.y);
    const sz2 = tension * (p3.z - p1.z);

    const ax = sx1 + sx2 + 2 * p1.x - 2 * p2.x;
    const ay = sy1 + sy2 + 2 * p1.y - 2 * p2.y;
    const az = sz1 + sz2 + 2 * p1.z - 2 * p2.z;

    const bx = -2 * sx1 - sx2 - 3 * p1.x + 3 * p2.x;
    const by = -2 * sy1 - sy2 - 3 * p1.y + 3 * p2.y;
    const bz = -2 * sz1 - sz2 - 3 * p1.z + 3 * p2.z;

    const cx = sx1;
    const cy = sy1;
    const cz = sz1;

    const dx = p1.x;
    const dy = p1.y;
    const dz = p1.z;

    // calculate the point
    const pt = new Point(
        ax * pct * pct * pct + bx * pct * pct + cx * pct + dx,
        ay * pct * pct * pct + by * pct * pct + cy * pct + dy,
        az * pct * pct * pct + bz * pct * pct + cz * pct + dz,
    )

    // calculate a close-by point to get the angle
    const pct2 = pct == 1 ? pct - 0.02 : pct + 0.02;
    const pt2 = new Point(
        ax * pct2 * pct2 * pct2 + bx * pct2 * pct2 + cx * pct2 + dx,
        ay * pct2 * pct2 * pct2 + by * pct2 * pct2 + cy * pct2 + dy,
        az * pct2 * pct2 * pct2 + bz * pct2 * pct2 + cz * pct2 + dz,
    )

    // return the point and the angle
    return {
        point: pt,
        angle: getAngle(pt, pt2)
    };
}

// gets the angle for a path segment
function getAngle(pt1: Point, pt2: Point): number {
    const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
    return Math.round(angle * 180 / Math.PI);
}