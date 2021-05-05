export interface IEventListener<S = any, T = EventArgs> {
    (sender: S, args: T): void;
}

/**
 * Defines a function that is executed when an {@link Event} is raised.
 */
class EventListener<S = any, T = EventArgs> {
    listener: IEventListener<S, T>;
    self: any;

    /**
     * Initializes a new instance of an {@link EventListener}.
     * @param listener Function that gets executed when the {@link Event} is raised.
     * @param self Object that acts as a **this** within the scope of the listener function.
     */
    constructor(listener: IEventListener<S, T>, self: any) {
        this.listener = listener;
        this.self = self;
    }
}

/**
 * Represents the parameters passed in to listeners attached to an {@link Event}.
 */
export class EventArgs {
    static empty = new EventArgs();
}

/**
 * Represents an event.
 * 
 * Events may have multiple listeners. Each listener is a function that
 * gets invoked when the event is raised.
 * 
 * Event listeners are functions that take two parameters: 
 * **sender** is the object that raised the event, and
 * **args** is an object that contains the event parameters.
 */
export class Event<S = any, T = EventArgs> {
    private _listeners: EventListener<S, T>[] = [];

    /**
     * Sets up a function that gets called whenever the event is raised.
     * 
     * @param listener Function that gets called whenever the event is raised.
     * @param self Value returned by the **this** keyword in the context of the
     * listener function.
     */
    addEventListener(listener: IEventListener<S, T>, self?: any) {
        this._listeners.push(new EventListener(listener, self));
    }
    /**
     * Removes an event listener so it no longer gets called when the event is raised.
     * 
     * @param listener Event listener to remove.
     * @param self Value returned by the **this** keyword in the context of the
     * listener function.
     */
    removeEventListener(listener: IEventListener<S, T>, self?: any) {
        for (let i = 0; i < this._listeners.length; i++) {
            let l = this._listeners[i];
            if (l.listener == listener || listener == null) {
                if (l.self == self || self == null) {
                    this._listeners.splice(i, 1);
                    if (self) {
                        break;
                    }
                }
            }
        }
    }
    /**
     * Raises an {@link Event}, which causes all attached listeners to be
     * invoked.
     * 
     * @param sender Object that raised the event.
     * @param args {@link EventArgs} object that contains the event parameters.
     */
    raise(sender: S, args: T) {
        for (let i = 0; i < this._listeners.length; i++) {
            let l = this._listeners[i];
            l.listener.call(l.self, sender, args);
        }
    }
}
