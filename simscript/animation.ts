import { Simulation } from './simulation';
import { Queue } from './queue';
import { Entity } from './entity';
import { assert, setOptions, getElement, clamp, IPoint, Point } from './util';

const
    _DEFAULT_ENTITY_ICON = '&#9899;', // black circle
    _DEFAULT_SPLINE_TENSION = 1;

// included by a-frame
declare var THREE: any;

/**
 * Defines animation parameters for animated {@link Queue} objects.
 */
export interface IAnimatedQueue {
    /**
     * {@link Queue} to animate.
     */
    queue: Queue,
    /**
     * HTML element that defines the {@see Queue} start location.
     */
    element: string | Element,
    /**
     * HTML element that defines the {@see Queue} end location.
     */
    endElement?: string | Element,
    /**
     * The {@link Queue} angle, in degrees, measured clockwise 
     * from the nine o'clock position (defaults to **zero**).
     */
    angle?: number,
    /**
     * Whether all entities should be shown stacked over each other 
     * rather than distributed along the given **angle**.
     */
    stackEntities?: boolean,
    /**
    * The maximum number of entities to display in the {@link Queue}.
    */
    max?: number,
}

/**
 * Class used to add animations to {@link Simulation} objects.
 * 
 * The {@link Animation} class adds animations to existing
 * {@link Simulation} objects. 
 * 
 * Animations are shown in a host element defined in the constructor. 
 * 
 * Animations may be in 2D or 3D.
 * 
 * 2D animations may be hosted in regular **div** elements. 
 * In this case, they use absolutely positioned elements (such as **img**)
 * to represent entities.
 * 
 * 2D animations may also be hosted in **svg** elements.
 * In this case, they use SVG (often *g*) elements to represent entities.
 * You can see a sample here:
 * [Animated Crosswalk (SVG)](https://stackblitz.com/edit/typescript-395kik?file=index.ts).
 * 
 * 3D animations may be hosted in [A-Frame](https://aframe.io) elements.
 * **A-Frame** is a 3D/VR framework that makes it easy to create 3D/VR animations.
 * You can see an example here:
 * [Animation Options (A-Frame)](https://stackblitz.com/edit/typescript-pmkehn?file=index.ts).
 * 
 * 3D animations may also be hosted in [X3DOM](https://www.x3dom.org/) 
 * elements. **X3DOM** is the latest W3C standard for 3D content.
 * You can see examples here:
 * [Animated Crosswalk (X3DOM)](https://stackblitz.com/edit/typescript-ehhn4e?file=index.ts)
 * and
 * [Animation Options (X3DOM)](https://stackblitz.com/edit/typescript-oncuqe?file=index.ts).
 * 
 * Entities are shown while in animated queues (see the {@link Entity.enterQueue} method)
 * and while in transit between animated queues (see the {@link Entity.delay} method).
 * 
 * {@link Queue} positions are defined by elements in the animation host element,
 * as specified when you set the {@link queues} property.
 * 
 * {@link Entity} objects are represented by elements whose appearance is specified by 
 * the {@link getEntityHtml} function.
 */
export class Animation {
    private _sim: Simulation;
    private _host: Element;
    private _scene: Element;
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

        // scene element
        this._scene = this._host;
        if (this.hostTag == 'X3D') {
            this._scene = this._host.querySelector('scene');
        }

        // simulation
        this._sim = sim;
        sim.timeNowChanged.addEventListener(this.updateDisplay, this);
        sim.stateChanged.addEventListener(this.updateDisplay, this);

        // slow down the simulation to keep the animation smooth
        sim.yieldInterval = 30; // about 60 fps

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
     * Gets the tag name of the element's host element.
     */
    get hostTag(): string {
        return this._host.tagName.toUpperCase();
    }
    /**
     * Gets a value that determines whether this animation is a 3D animation.
     */
    get isThreeD(): boolean {
        const tag = this.hostTag;
        return tag == 'X3D' || tag == 'A-SCENE';
    }
    /**
     * Gets a reference to the scene element.
     * 
     * In most cases, the scene element is the host element.
     * If the host is an X3D element, the scene element is the host's SCENE
     * child element.
     */
    get sceneElement(): Element {
        return this._scene;
    }
    /**
     * Gets or sets a function that returns the HTML to be used
     * to create elements that represent the animated entity.
     * 
     * The function should return the element's innerHTML.
     * The {@link Animation} class creates the outer HTML.
     * 
     * The innerHTML string format depends on the animation's
     * host element.
     * 
     * For regular **div** hosts, the function will usually
     * return a **div** or an **img** element.
     * 
     * For **SVG** hosts, the function will usually return
     * a **g** element, which represents an **SVG** group,
     * or an **SVG** primitive such as **polygon** or **circle**.
     * 
     * For **A-Frame** hosts, the function will usually return
     * an **a-entity** element.
     * 
     * For **X3D** hosts, the function will usually return a
     * **transform** element containing one of more **shape**
     * elements.
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
     * The items in the array should implement the {@link IAnimatedQueue} interface.
     * 
     * For example:
     * 
     * ```typescript
     * new Animation(sim, animationHost, {
     *     getEntityHtml: e => {...},
     *     queues: [
     *         { queue: sim.qPedArr, element: '.ss-queue.ped-arr' },
     *         { queue: sim.qPedXing, element: '.ss-queue.ped-xing', angle: -45, max: 8 },
     *         { queue: sim.qPedXed, element: '.ss-queue.ped-xed' },
     *         { queue: sim.qPedLeave, element: '.ss-queue.ped-leave' },
     *         ...
     *     ]
     * });
     * ```
     */
    get queues(): IAnimatedQueue[] {
        return this._queueArray;
    }
    set queues(value: IAnimatedQueue[]) {

        // save the new value
        this._queueArray = value;

        // create the animation queues
        value.forEach(item => {
            let aq = new AnimatedQueue(this, item);
            this._queues.set(aq._q, aq);
        });

        // update the display
        if (this._lastUpdate) {
            this._lastUpdate = -1;
            this.updateDisplay();
        }
    }
    /**
     * Updates the animation display by showing all entities in 
     * animated queues or in transit between animated queues.
     * 
     * This method is called by the {@link Animation} class 
     * automatically when the simulation time advances.
     */
    updateDisplay() {

        // reset queue start positions
         const
             host = this._host,
             sim = this._sim,
             rc = host.getBoundingClientRect();
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
                const
                    path = item.options.path,
                    tension = path.tension != null ? path.tension : _DEFAULT_SPLINE_TENSION,
                    radius = path.radius,
                    points: IPoint[] = [];
                path.queues.forEach((q, index) => {
                    const aq = this._queues.get(q);
                    assert(aq != null, 'Queue missing animation info');
                    points.push(this._toQueueEnd && path.queues.length == 2 && index > 0
                        ? aq._ptEnd || aq._getStart()
                        : aq._getStart());
                });

                // add extra points to honor turning radius option
                if (radius) {
                    applyRadius(points, radius);
                }

                // update entity icon
                ae._element.innerHTML = ae._getEntityHtml();

                // update entity position
                const
                    start = item.timeStart,
                    finish = item.timeDue,
                    pct = 1 - (finish - this._sim.timeNow) / (finish - start),
                    [pos, angle] = interpolatePath(points, tension, pct);
                
                // draw entity
                ae._drawAt(pos, this.rotateEntities ? angle : 0);
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
                    e.remove();
                }
            }
        });
    }

    // ** implementation

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
    private _anim: Animation;
    private _element: Element;
    private _elementEnd: Element;
    private _max: number;
    private _angle = 0;
    private _stackEntities: boolean;
    private _customPositions: boolean;
    /** internal */ _q: Queue;
    /** internal */ _ptStart: IPoint;
    /** internal */ _ptEnd: IPoint;

    // ctor
    constructor(anim: Animation, options: IAnimatedQueue) {
        this._anim = anim;
        this._q = options.queue;
        this._max = options.max;
        this._element = getElement(options.element);
        this._elementEnd = options.endElement ? getElement(options.endElement) : null;
        this._angle = (options.angle || 0);
        this._stackEntities = options.stackEntities;
        assert(this._q instanceof Queue, 'q parameter should be a Queue');
    }

    // gets the position of the queue start in DOM coordinates.
    _getStart(): IPoint {
        if (!this._ptStart) {
            this._ptStart = this._getElementPosition(this._element);
        }
        return this._ptStart;
    }

    // gets the position of the queue end in DOM coordinates.
    _getEnd(): IPoint {
        if (!this._ptEnd) {
            this._ptEnd = this._getElementPosition(this._elementEnd || this._element);
        }
        return this._ptEnd;
    }

    // gets the position of an element in DOM coordinates.
    _getElementPosition(e: Element): IPoint {
        const anim = this._anim;
        switch (anim.hostTag) {
            case 'X3D':
                return new BoundingBox(e).center;
            case 'A-SCENE':
                return Point.clone((e as any).object3D.position);
            case 'SVG':
                const rcSvg = (e as any).getBBox();
                return new Point(rcSvg.x + rcSvg.width / 2, rcSvg.y + rcSvg.height / 2, 0);
            default:
                const
                    rcHost = anim.hostElement.getBoundingClientRect(),
                    rcEl = e.getBoundingClientRect();
                return new Point(
                    rcEl.left - rcHost.left + rcEl.width / 2,
                    rcEl.top - rcHost.top + rcEl.height / 2,
                    0
                );
        }
    }

    // draws the entities in this animation queue.
    _draw() {
        const
            anim = this._anim,
            q = this._q;

        // skip this if we're empty
        if (!q.pop) {
            this._ptEnd = null;
            return;
        }

        // skip this if we're up-to-date
        if (!this._customPositions && q.lastChange < anim._lastUpdate && anim.hostTag != 'A-SCENE') {
            for (let item of this._q.items.values()) {
                const ae = anim._entities.get(item.entity);
                if (ae) {
                    ae._inUse = true;
                }
            }
            return;
        }

        // initialize insert position
        let pt = Point.clone(this._getStart());
        this._ptEnd = null;

        // loop through entities in the queue
        let cnt = 0;
        for (let item of q.items.values()) {

            // honor max numer of entities to display
            if (this._max != null && cnt >= this._max) {
                break;
            }

            // get entity and AnimatedEntity
            const
                e = item.entity,
                ae = anim._getAnimatedEntity(e);
            
            // update entity icon
            ae._element.innerHTML = ae._getEntityHtml();

            // use custom entity position
            const getPos = e.getAnimationPosition;
            if (getPos != Entity.prototype.getAnimationPosition) { // overridden
                const
                    start = Point.clone(this._getStart()),
                    end = Point.clone(this._getEnd()),
                    pos = getPos.call(e, q, start, end);
                if (pos != null) {
                    this._customPositions = true;
                    ae._drawAt(pos.position, pos.angle);
                    continue;
                }
            }

            // get queue angle
            const
                angle = this._angle * (anim.isThreeD ? -1 : +1),
                rad = -angle / 180 * Math.PI,
                sin = Math.sin(rad),
                cos = -Math.cos(rad);
    
            // prepare to draw
            const
                stack = this._stackEntities,
                hWid = stack ? 0 : ae._sz.x * cos / 2,
                hHei = stack ? 0 : (anim.rotateEntities ? ae._sz.x : ae._sz.y) * sin / 2;

            // update entity position and insertion point position
            pt.x += hWid;
            pt.y += hHei;
            ae._drawAt(pt, angle);
            pt.x += hWid;
            pt.y += hHei;

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
    private _anim: Animation;
    private _entity: Entity;
    /** internal */ private _element: Element;
    /** internal */ private _sz: IPoint;
    /** internal */ private _offset: IPoint;
    /** internal */ private _inUse: boolean;

    // ctor
    constructor(anim: Animation, entity: Entity) {
        this._anim = anim;
        this._entity = entity;
        this._inUse = false;

        // create animation element 
        let e: Element;
        switch (anim.hostTag) {
            case 'X3D':
                e = document.createElement('transform');
                break;
            case 'A-SCENE':
                e = document.createElement('a-entity');
                break;
            case 'SVG':
                e = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                (e as HTMLElement).style.opacity = '0';
                break;
            default:
                e = document.createElement('div');
                (e as HTMLElement).style.opacity = '0';
                break;
        }
        e.innerHTML = this._getEntityHtml();
        e.classList.add('ss-entity');
        this._element = e;

        // append animation element to host
        anim.sceneElement.appendChild(e);

        // measure element
        switch (anim.hostTag) {
            case 'X3D':
                const sz = new BoundingBox(e).size;
                this._sz = {
                    x: sz.x,
                    y: sz.y,
                    z: sz.z
                }
                break;
            case 'A-SCENE':
                this._sz = new Point();
                requestAnimationFrame(() => {
                    const
                        model = (e as any).object3D,
                        box = new THREE.Box3().setFromObject(model);
                    this._sz = {
                        x: box.max.x - box.min.x,
                        y: box.max.y - box.min.y,
                        z: box.max.z - box.min.z
                    }
                });
                break;
            case 'SVG':
                {
                    const rc = (e as any).getBBox();
                    this._sz = {
                        x: rc.width,
                        y: rc.height
                    }
                    this._offset = {
                        x: rc.x + rc.width / 2,
                        y: rc.y + rc.height / 2
                    }
                }
                break;
            default:
                {
                    const rc = e.getBoundingClientRect();
                    this._sz = {
                        x: rc.width,
                        y: rc.height
                    }
                    this._offset = {
                        x: rc.width / 2,
                        y: rc.height / 2
                    }
                }
                break;
        }
    }

    // gets the inner HTML for this entity's element
    _getEntityHtml() {
        const getEntity = this._anim.getEntityHtml;
        return getEntity
            ? getEntity(this._entity)
            : _DEFAULT_ENTITY_ICON;
    }

    // sets the position of this animated entity.
    _drawAt(pt: IPoint, angle?: number) {
        const
            anim = this._anim,
            e = this._element as HTMLElement,
            s = e.style;
        
        // update the entity element
        switch (anim.hostTag) {
            case 'X3D':
                e.setAttribute('translation', `${pt.x} ${pt.y} ${pt.z}`);
                e.setAttribute('rotation', `0 0 1 ${anim.rotateEntities ? angle / 180 * Math.PI : 0}`);
                break;
            case 'A-SCENE':
                const model = (e as any).object3D;
                model.position.set(pt.x, pt.y, pt.z);
                model.rotation.set(0, 0, angle && anim.rotateEntities ? angle / 180 * Math.PI : 0);
                break;
            case 'SVG':
            default:

                // adjust reference point (middle of the element)
                //const p = new Point(pt.x - this._width / 2, pt.y - this._height / 2, pt.z);
                const p = new Point(pt.x - this._offset.x, pt.y - this._offset.y);

                // calculate the transform
                let transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
                if (angle && anim.rotateEntities) {
                    transform += `rotate(${angle}deg) `;
                }

                // and apply it
                s.transform = transform;
                s.opacity = '';
                break;
        }

        // remember we're in use
        this._inUse = true;
    }
}

/**
 * Gets a position and an angle along a path defined by a vector of 
 * control points and a tension.
 * 
 * @param pts Vector of points that define the spline.
 * @param tension Spline tension (zero means each segment is a straight line, 
 * one creates smooth curves).
 * @param t Relative position within the spline (zero means first point,
 * one means last point).
 * 
 * @returns An array containing the the point along the spline and the angle
 * at the given percentage.
 */
function interpolatePath(pts: IPoint[], tension: number, t: number): [IPoint, number] {
    const
        ptDist = Point.distance,
        ptAng = Point.angle,
        ptInter = Point.interpolate,
        getPoint = (pts: IPoint[], index: number) => pts[clamp(index, 0, pts.length - 1)];

    // clamp range and tension
    t = clamp(t, 0, 1);
    tension = clamp(tension, 0, 1);

    // handle trivial cases
    if (pts.length < 3) {
        return pts.length == 2
            ? [ptInter(pts[0], pts[1], t), Point.angle(pts[0], pts[1])]
            : [pts[0], 0];
    }
 
    // compute total length, current position
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        len += ptDist(pts[i], pts[i + 1]);
    }
    const pos = t * len;

    // find current segment, percentage within the segment
    let idx = -1;
    let pctSeg = -1;
    len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        const segLen = ptDist(pts[i], pts[i + 1]);
        if (len + segLen >= pos) {
            idx = i;
            pctSeg = (pos - len) / segLen;
            break;
        }
        len += segLen;
    }
    
    // compute linear interpolation
    let p0 = pts[idx];
    let p1 = getPoint(pts, idx + 1);
    const
        ptLin = ptInter(p0, p1, pctSeg),
        angLin = ptAng(p0, p1);
    if (tension == 0) {
        return [ptLin, angLin];
    }

    // compute spline interpolation
    let p2: IPoint;
    if (pctSeg >= .5) {
        p1 = getPoint(pts, idx + 1);
        p0 = ptInter(pts[idx], p1, .5);
        p2 = ptInter(p1, getPoint(pts, idx + 2), .5);
    } else {
        p1 = pts[idx];
        p0 = ptInter(getPoint(pts, idx - 1), p1, .5);
        p2 = ptInter(pts[idx], getPoint(pts, idx + 1), .5);
    }

    // handle end points (fall back on linear)
    if ((idx == 0 && !ptDist(p0, p1)) || (idx == pts.length - 2 && !ptDist(p1, p2))) {
        return [ptLin, angLin];
    }

    // get the percentage within the spline
    const
        d1 = ptDist(p0, p1),
        d2 = ptDist(p1, p2),
        posSpl = (pos - len) + d1 * (pctSeg >= .5 ? -1 : +1),
        pctSpl = posSpl / (d1 + d2);

    // calculate spline point and angle
    const [ptSpl, angSpl] = interpolateSpline(p0, p1, p2, pctSpl);

    // return the result
    return [
        ptInter(ptLin, ptSpl, tension),
        tension > 0.1 ? angSpl : angLin
    ];
}

// calculates the point and angle at a given position along a spline
// https://javascript.info/bezier-curve
function interpolateSpline(p0: IPoint, p1: IPoint, p2: IPoint, t: number): [IPoint, number] {
    
    // spline point: P = (1−t)2 P1 + 2t(1−t) P2 + t2 P3
    const
        c0 = (1 - t) * (1 - t),
        c1 = 2 * (1 - t) * t,
        c2 = t * t,
        pt = {
            x: c0 * p0.x + c1 * p1.x + c2 * p2.x,
            y: c0 * p0.y + c1 * p1.y + c2 * p2.y,
            z: c0 * p0.z + c1 * p1.z + c2 * p2.z
        };

    // spline angle (in degrees): P' = 2(t-1) P1 + 2(1-2t) P2 + 2t P3
    const
        a0 = 2 * (t - 1),
        a1 = 2 * (1 - 2 * t),
        a2 = 2 * t,
        dx = a0 * p0.x + a1 * p1.x + a2 * p2.x,
        dy = a0 * p0.y + a1 * p1.y + a2 * p2.y,
        ang = Math.atan2(dy, dx) * 180 / Math.PI;

    // return point and angle
    return [pt, ang];
}

/**
 * Represents a bounding box for an X3D element.
 * 
 * The {@link Box} class has a {@link Box.center} and a 
 * {@link Box.size} properties that defines the position
 * and dimensions of the X3D element.
 */
class BoundingBox {
    center = new Point();
    size = new Point();

    constructor(e: Element) {

        // check if we have multiple elements to merge
        const g = e.querySelectorAll('shape>:not(appearance)');
        if (g.length == 0) { // single element
            this.applyGeometry(e);
            this.applyTransforms(e);
        } else { // multiple elements
            this.applyGeometry(g[0]);
            this.applyTransforms(g[0]);
            for (let i = 1; i < g.length; i++) {
                this.merge(new BoundingBox(g[i]));
            }
        }
    }

    private applyGeometry(e: Element) {
        const sz = this.size;
        switch (e.tagName) {
            case 'BOX':
                sz.x = sz.y = sz.z = 2;
                let atts = getAttributes(e, 'size');
                if (atts && atts.length >= 3) {
                    sz.x = atts[0];
                    sz.y = atts[1];
                    sz.z = atts[2];
                }
                break;
            case 'CONE':
                sz.x = sz.z = 2 * Math.max(getAttribute(e, 'topRadius', 0), getAttribute(e, 'BottomRadius', 0));
                sz.y = getAttribute(e, 'height', 0);
                break;
            case 'CYLINDER':
                sz.x = sz.y = 2 * getAttribute(e, 'radius', 0);
                sz.z = getAttribute(e, 'height', 0);
                break;
            case 'SPHERE':
                sz.x = sz.y = sz.z = 2 * getAttribute(e, 'radius', 1);
                break;
            default:
                console.error('skipping unknown geometry', e.tagName);
                break;
        }
    }
    private applyTransforms(el: Element) {
        for (let e = el.closest('transform'); e != null; e = e.parentElement.closest('transform')) {
            const t = getAttributes(e, 'translation');
            if (t && t.length >= 3) {
                const c = this.center;
                c.x += t[0];
                c.y += t[1];
                c.z += t[2];
            }
            const s = getAttributes(e, 'scale');
            if (s && s.length >= 3) {
                const sz = this.size;
                sz.x *= s[0];
                sz.y *= s[1];
                sz.z *= s[2];
            }
        }
    }
    private merge(box: BoundingBox) {
        const
            c = this.center,
            sz = this.size,
            bc = box.center,
            bsz = box.size;

        // compute min/max points
        const min = new Point(
            Math.min(c.x - sz.x / 2, bc.x - bsz.x / 2),
            Math.min(c.y - sz.y / 2, bc.y - bsz.y / 2),
            Math.min(c.z - sz.z / 2, bc.z - bsz.z / 2),
        );
        const max = new Point(
            Math.max(c.x + sz.x / 2, bc.x + bsz.x / 2),
            Math.max(c.y + sz.y / 2, bc.y + bsz.y / 2),
            Math.max(c.z + sz.z / 2, bc.z + bsz.z / 2),
        );

        // update this box
        c.x = (min.x + max.x) / 2;
        c.y = (min.y + max.y) / 2;
        c.z = (min.z + max.z) / 2;
        sz.x = max.x - min.x;
        sz.y = max.y - min.y;
        sz.z = max.y - min.y;
    }
}

// utilities
function getAttributes(e: Element, attName: string): number[] {
    const
        att = e.getAttribute(attName),
        atts = att ? att.split(/\s*,\s*|\s+/) : null;
    return atts ? atts.map(item => parseFloat(item)) : null;
}
function getAttribute(e: Element, attName: string, defVal: number): number {
    const att = e.getAttribute(attName);
    return att ? parseFloat(att) : defVal;
}

// applies a turning radius to a path by adding extra points
function applyRadius(pts: IPoint[], radius: number) {
    if (radius > 0 && pts.length > 2) {
        for (let i = pts.length - 2; i >= 0; i--) {
            const
                start = pts[i],
                end = pts[i + 1],
                len = Point.distance(start, end);
            if (len > 2 * radius) {
                
                // new point at segment start
                let idx = i + 1;
                if (i > 0) {
                    const pt = Point.interpolate(start, end, radius / len);
                    pts.splice(idx++, 0, pt);
                }

                // new point at segment end
                if (i < pts.length - 2) {
                    const pt = Point.interpolate(start, end, 1 - (len - radius) / len);
                    pts.splice(idx, 0, pt);
                }
            }
        }
    }
}
