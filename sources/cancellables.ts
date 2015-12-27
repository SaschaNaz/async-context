namespace Cancellables {
    namespace util {
        export function assign<T>(target: T, ...sources: any[]) {
            if ((<any>Object).assign)
                return <T>((<any>Object).assign)(target, ...sources);

            for (let source of sources) {
                source = Object(source);
                for (let property in source) {
                    (<any>target)[property] = source[property];
                }
            }
            return target;
        }
    }

    export var cancellation: any = new Proxy(() => { }, {
        set: () => false,
        get: (target: any, property: any) => property !== "then" ? cancellation : undefined, // non-PromiseLike 
        construct: () => cancellation,
        apply: () => cancellation
    });

    export var cancelSymbol = Symbol("cancel");

    //     /*
    //         Keys for Contract class 
    //     */
    //     let resolveKey = generateSymbolKey("resolve");
    //     let rejectKey = generateSymbolKey("reject");
    //     let cancelKey = generateSymbolKey("cancel");
    //     let resolveCancelKey = generateSymbolKey("cancel-resolve");
    //     let modifiableKey = generateSymbolKey("modifiable");
    //     let revertKey = generateSymbolKey("revert");
    //     let canceledKey = generateSymbolKey("canceled");
    //     let thisKey = generateSymbolKey("this");
    //     let optionsKey = generateSymbolKey("options");
    // 
    //     /*
    //         Keys for AsyncContext
    //     */
    //     let feederKey = generateSymbolKey("feeder");
    //     let resolveFeederKey = generateSymbolKey("resolve-feeder");
    //     let rejectFeederKey = generateSymbolKey("reject-feeder");
    //     let feederControllerKey = generateSymbolKey("feeder-controller")
    //     let queueKey = generateSymbolKey("queue");
    //     let cancelAllKey = generateSymbolKey("cancel-all")
    //     let removeFromQueueKey = generateSymbolKey("remove-from-queue");
    // 
    //     /*
    //         Keys for AsyncQueueItem
    //     */
    //     let contextKey = generateSymbolKey("context");
    //     let cancellationAwaredKey = generateSymbolKey("cancellation-awared")

    export interface CancellableOptionBag {
        /** Reverting listener for a contract. This will always be called after a contract gets finished in any status. */
        revert?: (status: string) => any | PromiseLike<any>;
        // silentOnCancellation?: boolean;
        // How about returning Cancellation object automatically cancel chained contracts? - What about promises then? Unintuitive.

        // do nothing but just pass Cancellation object when it receives it 
        // passCancellation?: boolean;

        // for async cancellation process
        deferCancellation?: boolean;

        precancel?: () => any | PromiseLike<any>;
    }

    export interface CancellableController {
        canceled: boolean;
        confirmCancellation: () => Promise<void>;
    }

    export interface CancellableInternal {
        canceled: boolean;
        modifiable: boolean;

        resolve: <T>(value?: T | PromiseLike<T>) => void;
        reject: (reason?: any) => void;
        revert: (status: string) => any;

        options: CancellableOptionBag;
    }

    export class Cancellable<T> extends Promise<T> {
        get canceled() { return this._internal.canceled }

        _internal: CancellableInternal;

        constructor(init: (resolve: (value?: T | PromiseLike<T>) => Promise<void>, reject: (reason?: any) => Promise<void>, controller: CancellableController) => void, options?: CancellableOptionBag) {
            options = util.assign<CancellableOptionBag>({}, options); // pass cancellation by default
            let revert = options.revert;

            let internal = {} as CancellableInternal;

            super((resolve: (value?: T | PromiseLike<T>) => void, reject: (error?: any) => void) => {
                internal.resolve = resolve; // newThis is unavailable at construction
                internal.reject = reject;
                internal.revert = revert;
                internal.modifiable = true;
                internal.canceled = false;
                internal.options = options;

                let controller: CancellableController = {
                    get canceled() { return this._canceled },
                    confirmCancellation: () => {
                        internal.options.deferCancellation = false;
                        internal.canceled = true;
                        return this._resolveCancel();
                    }
                }

                try {
                    init(
                        (value) => {
                            if (!internal.modifiable) {
                                return;
                            }
                            internal.modifiable = false; // newThis may not be obtained yet but every assignation will be reassigned after obtaining
                            let sequence = Promise.resolve();
                            if (revert) {
                                sequence = sequence.then(() => revert("resolved"));
                            }
                            return sequence.then(() => resolve(value)).catch((error) => reject(error)); // reject when revert failed
                        },
                        (error) => {
                            if (!internal.modifiable) {
                                return;
                            }
                            internal.modifiable = false;
                            let sequence = Promise.resolve();
                            if (revert) {
                                sequence = sequence.then(() => revert("rejected"));
                            }
                            return sequence.then(() => reject(error)).catch((error) => reject(error));
                        },
                        controller
                    )
                }
                catch (error) {
                    // error when calling init
                    reject(error);
                }
            });


            this._internal = internal;
        }

        /*
        This is blocking destructuring, any solution?
        example: let [foo, bar] = await Baz();
        Returning Canceled object will break this code
        Every code that does not expect cancellation will be broken
        ... but codes that explicitly allow it should also expect it.
        Cancellation still is not so intuitive. What would users expect when their waiting promise be cancelled?
        1. just do not call back - this will break ES7 await 
        2. return Canceled object - potentially break codes; users have to check it every time
        3. add oncanceled callback function - this also will break await 
        
        2-1. Can cancellation check be automated, inline?
        let [x, y] = await cxt.queue(foo); // what can be done here?
        Make cancellation object special: hook indexer and make them all return cancellation object
        (await cxt.queue(foo)).bar(); // .bar will be cancellation object, and .bar() will also be.
        
        */

        [cancelSymbol]() {
            if (!this._internal.modifiable || this._internal.canceled) {
                return Promise.reject(new Error("Already locked"));
            }
            this._internal.canceled = true;
            let sequence = Promise.resolve();
            if (this._internal.options.precancel) {
                sequence = sequence.then(() => this._internal.options.precancel());
                // precancel error should be catched by .cancel().catch()
            }
            if (!this._internal.options.deferCancellation) {
                return sequence.then(() => this._resolveCancel());
            }
            else {
                return sequence.then(() => this.then<void>());
            }
            // Thought: What if Contract goes on after cancelled? [cancel]() will immediately resolve contract but actual process may not be immediately canceled.
            // cancel() should return Promise (not Contract, no cancellation for cancellation)

            // no defer: Promise.resolve
            // defer: should cancellation promise be resolved before target contract? Not sure
        }

        _resolveCancel() {
            this._internal.modifiable = false;
            let sequence = Promise.resolve();
            if (this._internal.revert) {
                sequence = sequence.then(() => this._internal.revert("canceled"));
            }
            return sequence.then(() => this._internal.resolve(cancellation)).catch((error) => this._internal.reject(error));
            // won't resolve with Cancellation when already resolved 
        }
    }

    export class CancellableContext<T> {
        _canceled: boolean;
        _modifiable: boolean;

        _queue: AsyncQueueItem<any>[];
        _feeder: CancellableFeed<T>;
        _feederController: CancellableController;

        _resolveFeeder: <T>(value?: T | PromiseLike<T>) => Promise<void>;
        _rejectFeeder: (reason?: any) => Promise<void>;

        constructor(callback: (context: CancellableContext<T>) => any, options?: CancellableOptionBag) {
            options = util.assign<CancellableOptionBag>({}, options);
            this._queue = [];
            this._modifiable = true;
            this._canceled = false;
            this._feeder = new CancellableFeed<T>((resolve, reject, controller) => {
                this._resolveFeeder = resolve;
                this._rejectFeeder = reject;
                this._feederController = controller;
            }, {
                    revert: (status) => {
                        this._modifiable = false;
                        let sequence = Promise.resolve();
                        if (status !== "canceled") {
                            sequence = sequence.then(() => this._cancelAll());
                        }
                        return sequence.then(() => {
                            if (options.revert) {
                                return options.revert(status);
                            }
                        });
                        /*
                        TODO: feed().cancel() does not serially call revert() when deferCancellation and this blocks canceling queue item 
                        proposal 1: add oncancel(or precancel) on ContractOptionBag
                        proposal 2: add flag to call revert() earlier even when deferCancellation
                        */
                    },
                    precancel: () => {
                        // still modifiable at the time of precancel
                        return Promise.resolve().then(() => {
                            if (options.precancel) {
                                return options.precancel();
                            }
                        }).then(() => this._cancelAll());
                    },
                    deferCancellation: options.deferCancellation
                });
            Promise.resolve().then(() => callback(this)).catch((error) => this._rejectFeeder(error));
        }

        _cancelAll() {
            return Promise.all(this._queue.map((item) => {
                if (item._internal.modifiable && !item._internal.canceled) {
                    return item[cancelSymbol]() as Promise<void>
                }
            })).then<void>();

            // for (let item of this[queueKey]) {
            //     (<Contract<any>>item)[cancelKey]();
            // }
        }

        /* TODO: `options` should be utilized */
        queue<U>(callback?: () => U | PromiseLike<U>, options?: CancellableOptionBag) {
            let promise: Promise<U>
            if (typeof callback === "function") {
                promise = Promise.resolve().then(() => callback()); // promise will be rejected gracely when callback() fails
            }
            let output = new AsyncQueueItem<U>((resolve, reject) => {
                // resolve/reject must be called after whole promise chain is resolved
                // so that the queue item keep being modifiable until resolving whole chain 
                Promise.resolve(promise).then(resolve, reject);
            }, {
                    revert: (status) => {
                        if (status === "canceled" && promise && typeof promise[cancelSymbol] === "function") {
                            (<Cancellable<U>>promise)[cancelSymbol]();
                        }
                        this._removeFromQueue(output);
                    },
                    context: this
                });
            this._queue.push(output);
            return output; // return an object that support chaining
        }

        _removeFromQueue(item: AsyncQueueItem<any>) {
            let queueIndex = this._queue.indexOf(item);
            this._queue.splice(queueIndex, 1);
        }

        feed() {
            return this._feeder;
        }

        get canceled() {
            return this._feeder._internal.canceled || this._canceled;
        }

        resolve(value?: T): Promise<void> {
            this._modifiable = false;
            return this._resolveFeeder(value);
        }
        reject(error?: any): Promise<void> {
            this._modifiable = false;
            return this._rejectFeeder(error);
        }
        cancel(): Promise<void> {
            this._canceled = true;
            return this._feederController.confirmCancellation();
        }
    }

    export interface AsyncQueueConstructionOptionBag extends CancellableOptionBag {
        context: CancellableContext<any>;
    }

    export interface AsyncQueueOptionBag extends CancellableOptionBag {
        behaviorOnCancellation?: string; // "pass"(default), "silent", "none"
    }

    // Can chaining characteristics of AsyncQueueItem be used generally? 
    export class AsyncQueueItem<T> extends Cancellable<T> {
        get context() { return this._context }
        _context: CancellableContext<any>;
        _cancellationAwared: boolean;

        constructor(init: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void, options: AsyncQueueConstructionOptionBag) {
            // A Promise subclass must allow constructing only with `init` parameter
            // Then `options` must be set after construction to correctly indicate the context
            if (options && !(options.context instanceof CancellableContext)) {
                throw new Error("An AsyncContext object must be given by `options.context`.");
            }
            super(init, options);
            if (options) {
                this._context = options.context;
            }
            this._cancellationAwared = false;
        }

        queue<U>(onfulfilled?: (value: T) => U | PromiseLike<U>, options?: AsyncQueueOptionBag) {
            options = util.assign<any>({ behaviorOnCancellation: "pass" }, options);
            return this.then(onfulfilled, undefined, options);
        }

        then<U>(onfulfilled?: (value: T) => U | PromiseLike<U>, onrejected?: (error: any) => U | PromiseLike<U>, options?: AsyncQueueOptionBag): AsyncQueueItem<U> {
            options = util.assign<any>({ behaviorOnCancellation: "none" }, options);
            
            let resolver: U | PromiseLike<U>;

            let resolveWithCancellationCheck = (value?: T) => {
                /*
                What should happen when previous queue is resolved after context cancellation?
                1. check cancellation and resolve with Cancellation object
                
                Cancellation cancellation cancellation... processing cancellation is too hard then. (if queue chain ever uses arguments)
                - fixed by behaviorOnCancellation: "pass"
                - still too long, should it be default value for queue items?
                - okay, make it default
                */
                if (this.context.canceled && !this._cancellationAwared) {
                    value = cancellation;
                    output._cancellationAwared = true;
                    /*
                    TODO: use cancellationAwaredKey so that Cancellation passes only until first behaviorOnCancellation: "none"
                    The key should not on context as it can contain multiple parallel chains
                    Can it be on AsyncQueueConstructorOptionBag? No, construction occurs before cancellation
                    super.then is always asynchronous so `output` is always already obtained
                    */
                }
                if (value === cancellation) {
                    if (options.behaviorOnCancellation === "silent") {
                        return new Promise(() => { }); // never resolve
                    }
                    else if (options.behaviorOnCancellation === "pass") {
                        return cancellation; // never call onfulfilled
                    }
                }
                let result: U | PromiseLike<U>;
                try {
                    if (typeof onfulfilled === "function") {
                        result = onfulfilled(value);
                    }
                }
                catch (e) {
                    result = Promise.reject(e) as Promise<any>;
                }
                return result;
                // resolve should be called only when full promise chain is resolved
                // so that .revert can only be called when all is over 
            };

            let output = super.then(
                (value) => {
                    this.context._queue.push(output);
                    return resolver = resolveWithCancellationCheck(value);
                },
                (error) => {
                    this.context._queue.push(output);

                    if (this.context.canceled) {
                        return resolveWithCancellationCheck();
                        // no onrejected call when canceled
                    }
                    
                    let result: U | PromiseLike<U>;
                    try {
                        if (typeof onrejected === "function") {
                            result = onrejected(error);
                        }
                    }
                    catch (e) {
                        result = Promise.reject(e) as Promise<any>;
                    }
                    return resolver = result;
                }
            ) as AsyncQueueItem<U>;
            
            // options assignation always happens before output resolves
            /*
            let promise; // resolved promise
            promise.then(() => console.log("resolved"));
            console.log("console");
            output: console, resolved
            */
            output._internal.options = {
                revert: (status) => {
                    let sequence = Promise.resolve();
                    if (status === "canceled" && resolver && typeof resolver[cancelSymbol] === "function") {
                        sequence = sequence.then(() => (resolver as Cancellable<U>)[cancelSymbol]());
                    }
                    sequence = sequence.then(() => this.context._removeFromQueue(output));
                    if (options.revert) {
                        sequence = sequence.then(() => options.revert(status));
                    }
                    return sequence;
                }
            };
            output._context = this.context
            return output;
        }

        catch<U>(onrejected?: (error: any) => U | PromiseLike<U>, options?: CancellableOptionBag) {
            return this.then(undefined, onrejected, options);
        }
    }

    // better name? this can be used when a single contract only is needed
    export class CancellableFeed<T> extends Cancellable<T> {
        cancel(): Promise<void> {
            return this[cancelSymbol]();
        }
    }
}
