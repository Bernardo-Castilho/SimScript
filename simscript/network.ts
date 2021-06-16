import { assert, setOptions, IPoint, Point } from './util';
import { Queue } from './queue';

/**
 * Defines properties for network nodes.
 */
export interface INode {
    /** Gets or sets the node's ID. */
    id?: string;
    /** Gets or sets the node's position. */
    position?: IPoint;
    /** Gets or sets the {@link Queue} associated with the node. */
    queue?: Queue
}

/**
 * Defines properties for network links.
 */
export interface ILink {
    /** Gets or sets the link's ID. */
    id?: string;
    /** Gets or sets the link's **from** {@link INode}. */
    from: INode;
    /** Gets or sets the link's **to** {@link INode}. */
    to: INode;
    /**
     * Gets or sets the link's distance.
     * If ommitted, the distance is calculated based on the position
     * of the **from** and **to** nodes. */
    distance?: number;
    /**
     * Gets or sets a value that determines whether the link is
     * currently disabled.
     */
    disabled?: boolean;
}

// Defines properties for path segments.
interface PathPart {
    id?: string;
    node: INode,
    distance: number,
    link: ILink
};

/**
 * Represents a network defined by an array of {@link INode} and an
 * array of {@link ILink} elements along which entities may move.
 * 
 * Networks can be used to simulate streets, rails, rivers, or any
 * other system with nodes connected by links.
 * 
 * Use networks to select the shortest path between two points in
 * the simulation, them move entities along the path using the entity's
 * {@link Entity.delay} method.
 * 
 * For an example, please see the {@link shortestPath} method.
 */
export class Network {
    _nodes: INode[];
    _links: ILink[];
    
    /**
     * Initializes a new instance of the {@link Network} class.
     * 
     * @param options Object with parameters used to initialize the {@link Network}.
     */
    constructor(options?: any) {
        setOptions(this, options);
    }

    /**
     * Gets or sets the network nodes.
     */
     set nodes(value: INode[]) {
        this._nodes = value;
    }
    get nodes(): INode[] {
        return this._nodes;
    }
    /**
     * Gets or sets the network links.
     */
    set links(value: ILink[]) {
        this._links = value;
    }
    get links(): ILink[] {
        return this._links;
    }
    /**
     * Gets the node with a given ID.
     * @param id ID of the node to get.
     */
    getNode(id: any): INode {
        id = id.toString();
        return this._nodes.find(nd => nd.id == id);
    }
    /**
     * Computes the shortest path between two nodes on the network.
     * 
     * The **shortestPath** method returns an array of {@link ILink} 
     * objects that represent the shortest path between two network
     * {@link ILink} objects. 
     * 
     * If a path between the nodes cannot be found, the method returns
     * an empty array.
     * 
     * The example below shows how you to move an {@link Entity}
     * between to nodes on a {@link Network}:
     * 
     * ```typescript
     * class Vehicle extends Entity {
     *     async script() {
     * 
     *         // get a reference to the simulation
     *         const sim = this.simulation as NetworkIntro;
     * 
     *         // select from/to nodes
     *         const from = sim.network.nodes[0];
     *         const to = sim.network.nodes[10];
     * 
     *         // calculate the shortest path
     *         const path = sim.network.shortestPath(from, to);
     *         assert(path.length > 0, 'cannot reach destination');
     * 
     *         // move along the path one link at a time
     *         for (let i = 0; i < path.length; i++) {
     *             const link = path[i];
     *             const distance = sim.network.getLinkDistance(link, i > 0 ? path[i - 1] : null);
     *             const time = distance / sim.serviceVehicleSpeed.sample();
     *             await this.delay(time, {
     *                 queues: [link.from.queue, link.to.queue] // used in animations
     *             });
     *         }
     *     }
     * }
     * ```
     * 
     * You can also use the {@link mergePath} method to get a list of queues 
     * that make up the path and the total path distance, and use those 
     * elements to travel the entire path with a single delay:
     * 
     * ```typescript
     * // calculate the shortest path
     * const path = sim.network.shortestPath(from, to);
     * assert(path.length > 0, 'cannot reach destination');
     * 
     * // merge the path into a list of queues
     * const [queues, distance] = sim.network.mergePath(path);
     * 
     * // traverse the whole path with a single delay
     * await this.delay(distance / sim.speed.sample(), {
     *     queues: queues,
     *     tension: 0.5
     * });
     * ```
     * 
     * @param start Start {@link INode}.
     * @param finish Finish {@link INode}.
     * @returns An array of {@link ILink} objects that describe the
     * shortest path from **start** to **finish**, or an empty array
     * if a path could not be found.
     */
    shortestPath(start: INode, finish: INode): ILink[] {

        // ** REVIEW: switch to A* for efficiency?

        // create the unvisited list with the following headings
        const
            unvisited: PathPart[] = [],
            visited: PathPart[] = [];
        this._nodes.forEach(node => {
            unvisited.push({
                id: node.id,
                node: node,
                distance: node == start ? 0 : Infinity, // starting node has distance/cost zero
                link: null
            });
        });

        // build path
        while (unvisited.length) {

            // find the unvisited node that has the lowest distance and make it current
            let current: PathPart = null;
            unvisited.forEach(pp => {
                if (current == null || pp.distance < current.distance) {
                    current = pp;
                }
            });

            // move current node from unvisited to visited
            unvisited.splice(unvisited.indexOf(current), 1);
            visited.push(current);

            // examine the nodes that can be reached directly from the current node
            // that have not yet been visited
            if (unvisited.length) {
                this._links.forEach(link => {
                    if (link.from == current.node && !link.disabled) {
                        unvisited.forEach(pp => {
                            if (pp.node == link.to) {
                                const distance = current.distance + this.getLinkDistance(link, current.link);
                                if (distance < pp.distance) {
                                    pp.distance = distance;
                                    pp.link = link;
                                }
                            }
                        });
                    }
                });
            }
        }

        // done, retrieve path as a list of nodes
        const linkPath: ILink[] = [];
        for (let node = finish; node != null;) {
            const
                part = this._getPathPart(visited, node),
                link = part.link;
            if (!link) {
                break;
            }
            node = link.from;
            linkPath.unshift(link);
        }
        return linkPath;
    }
    /**
     * Gets the distance (cost) associated with a link.
     * 
     * The function returns the link's **distance** value, if specified,
     * or the distance between the link's **from** and **to** nodes.
     * 
     * @param link Link whose distance is being evaluated.
     * @param prevLink Previous link in the path (used to calculate turning costs).
     * @returns The distance (cost) associated with the link.
     */
    getLinkDistance(link: ILink, prevLink?: ILink): number {
        let distance = null;
        
        // calculate link distance/cost
        if (link.distance != null) {
            distance = link.distance;
        } else {
            assert(link.from.position != null && link.to.position != null, 'link must have a distance or connect points with positions');
            distance = Point.distance(link.from.position, link.to.position);
        }

        /*
        // add turning cost
        if (prevLink) {
            const
                a1 = this._getLinkAngle(link),
                a2 = this._getLinkAngle(prevLink);
            let angle = Math.abs(a1 - a2) / Math.PI * 180; // turn in radians
            //distance += f(angle)?
        }
        */

        // done
        return distance;
    }
    /**
     * Merges a path defined by an array of {@link ILink} objects into an
     * array of {@link Queue} objects.
     * 
     * This makes it possible for entities to traverse the whole path
     * with a single delay. For example:
     * 
     * ```typescript
     * // select from/to nodes
     * const from = sim.network.nodes[0];
     * const to = sim.network.nodes[10];
     * 
     * // get shortest path
     * const path = sim.network.shortestPath(from, to);
     * 
     * // merge the path into a list of queues
     * const [queues, distance] = sim.network.mergePath(path);
     * 
     * // traverse the whole path with a single delay
     * await this.delay(distance / sim.speed.sample(), {
     *     queues: queues,
     *     tension: 0.5
     * });
     * ```
     * 
     * @param path Array of {@link ILink} objects that defines the path.
     * @returns An array where the first element is an array of 
     * {@link Queue} objects to be visited and the second is the total
     * path distance.
     */
    mergePath(path: ILink[]): [Queue[], number] {
        const queues = [];
        let dist = 0;
        path.forEach((link: ILink, i: number) => {
            dist += this.getLinkDistance(link, i > 0 ? path[i - 1] : null);
            if (i == 0) {
                queues.push(link.from.queue);
            }
            queues.push(link.to.queue);
        });
        return [queues, dist];
    }

    // ** implementation

    _getLinkAngle(link: ILink): number {
        return Point.angle(link.from.position, link.to.position, true);
    }
    _getPathPart(visited: PathPart[], node: INode): PathPart {
        for (let i = 0; i < visited.length; i++) {
            let pp = visited[i];
            if (pp.node == node) {
                return pp;
            }
        }
        return null;
    }
}