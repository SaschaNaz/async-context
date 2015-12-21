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

    export class Cancellable<T> extends Promise<T> {
        get canceled() { return this._canceled }
        _canceled: boolean;
        _modifiable: boolean;

        _resolve: <T>(value?: T | PromiseLike<T>) => void;
        _reject: (reason?: any) => void;
        _revert: (status: string) => any;
        
        _options: CancellableOptionBag;

        constructor(init: (resolve: (value?: T | PromiseLike<T>) => Promise<void>, reject: (reason?: any) => Promise<void>, controller: CancellableController) => void, options?: CancellableOptionBag) {
            options = util.assign<CancellableOptionBag>({}, options); // pass cancellation by default
            let revert = options.revert;
            let newThis = this; // only before getting real newThis
            let controller: CancellableController = {
                get canceled() { return newThis._canceled },
                confirmCancellation: () => {
                    this._options.deferCancellation = false;
                    this._canceled = true;
                    return this._resolveCancel();
                }
            }

            let listener = (resolve: (value?: T | PromiseLike<T>) => void, reject: (error?: any) => void) => {
                this._resolve = resolve; // newThis is unavailable at construction
                this._reject = reject;
                this._revert = revert;
                this._modifiable = true;
                this._canceled = false;
                this._options = options;

                try {
                    init(
                        (value) => {
                            if (!newThis._modifiable) {
                                return;
                            }
                            newThis._modifiable = false; // newThis may not be obtained yet but every assignation will be reassigned after obtaining
                            let sequence = Promise.resolve();
                            if (revert) {
                                sequence = sequence.then(() => revert("resolved"));
                            }
                            return sequence.then(() => resolve(value)).catch((error) => reject(error)); // reject when revert failed
                        },
                        (error) => {
                            if (!newThis._modifiable) {
                                return;
                            }
                            newThis._modifiable = false;
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
            };

            newThis = window.SubclassJ ? SubclassJ.getNewThis(Cancellable, Promise, [listener]) : this;
            if (!window.SubclassJ) {
                super(listener);
            }

            newThis._resolve = this._resolve;
            newThis._reject = this._reject;

            // guarantee every assignation before obtaining newThis be applied on it
            newThis._revert = this._revert;
            newThis._modifiable = this._modifiable;
            newThis._canceled = this._canceled;
            newThis._options = this._options;

            return newThis;
            //super(listener);
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
            if (!this._modifiable || this._canceled) {
                return Promise.reject(new Error("Already locked"));
            }
            this._canceled = true;
            let sequence = Promise.resolve();
            if (this._options.precancel) {
                sequence = sequence.then(() => this._options.precancel());
                // precancel error should be catched by .cancel().catch()
            }
            if (!this._options.deferCancellation) {
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
            this._modifiable = false;
            let sequence = Promise.resolve();
            if (this._revert) {
                sequence = sequence.then(() => this._revert("canceled"));
            }
            return sequence.then(() => this._resolve(cancellation)).catch((error) => this._reject(error));
            // won't resolve with Cancellation when already resolved 
        }
    }

    export class AsyncContext<T> {
        _canceled: boolean;
        _modifiable: boolean;
        
        _queue: AsyncQueueItem<any>[];
        _feeder: AsyncFeed<T>;
        _feederController: CancellableController;
        
        _resolveFeeder: <T>(value?: T | PromiseLike<T>) => Promise<void>;
        _rejectFeeder: (reason?: any) => Promise<void>;

        constructor(callback: (context: AsyncContext<T>) => any, options?: CancellableOptionBag) {
            options = util.assign<CancellableOptionBag>({}, options);
            this._queue = [];
            this._modifiable = true;
            this._canceled = false;
            this._feeder = new AsyncFeed<T>((resolve, reject, controller) => {
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
                if (item._modifiable && !item._canceled) {
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
            return this._feeder._canceled || this._canceled;
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
        context: AsyncContext<any>;
    }

    export interface AsyncQueueOptionBag extends CancellableOptionBag {
        behaviorOnCancellation?: string; // "pass"(default), "silent", "none"
    }

    // Can chaining characteristics of AsyncQueueItem be used generally? 
    export class AsyncQueueItem<T> extends Cancellable<T> {
        get context() { return this._context }
        _context: AsyncContext<any>;
        _cancellationAwared: boolean;

        constructor(init: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void, options: AsyncQueueConstructionOptionBag) {
            if (!(options.context instanceof AsyncContext)) {
                throw new Error("An AsyncContext object must be given by `options.context`.");
            }
            let newThis = window.SubclassJ ? SubclassJ.getNewThis(AsyncQueueItem, Cancellable, [init, options]) : this;
            if (!window.SubclassJ) {
                super(init, options);
            }

            newThis._context = this._context = options.context;
            newThis._cancellationAwared = this._cancellationAwared = false;
            return newThis;
        }

        queue<U>(onfulfilled?: (value: T) => U | PromiseLike<U>, options?: AsyncQueueOptionBag) {
            options = util.assign<any>({ behaviorOnCancellation: "pass" }, options);
            return this.then(onfulfilled, undefined, options);
        }

        then<U>(onfulfilled?: (value: T) => U | PromiseLike<U>, onrejected?: (error: any) => U | PromiseLike<U>, options?: AsyncQueueOptionBag) {
            let promise: Promise<U>;
            options = util.assign<any>({ behaviorOnCancellation: "none" }, options);

            let output = new AsyncQueueItem<U>((resolve, reject) => {
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
                            return; // never resolve
                        }
                        else if (options.behaviorOnCancellation === "pass") {
                            resolve(cancellation);
                            return; // never call onfulfilled
                            /*
                            TODO: This blocks await expression from receiving Cancellation
                            proposal: make .queue as syntax sugar for .then(, { behaviorOnCancellation: "pass" })
                            and set the default value as "none" for .then
                            
                            TODO: awaiter uses .then(onfulfill, onreject) but queue item doesn't use this
                            .then(onfullfill, onreject, options)
                            .queue(onfulfill, options)
                            .catch(onfulfill, options)
                            better name for .queue()? just make it queue as it have
                            different default behaviorOnCancellation value
                            */
                        }
                    }
                    if (typeof onfulfilled === "function") {
                        promise = Promise.resolve().then(() => onfulfilled(value)); // gracely reject when fail
                    }
                    Promise.resolve(promise).then(resolve, reject);
                    // resolve should be called only when full promise chain is resolved
                    // so that .revert can only be called when all is over 
                };

                super.then(
                    (value) => {
                        this.context._queue.push(output);
                        resolveWithCancellationCheck(value);
                    },
                    (error) => {
                        this.context._queue.push(output);

                        if (this.context.canceled) {
                            resolveWithCancellationCheck();
                            return; // no onrejected call when canceled
                        }
                        if (typeof onrejected === "function") {
                            promise = Promise.resolve().then(() => onrejected(error));
                        }
                        Promise.resolve(promise).then(resolve, reject);
                    })
            }, {
                    revert: (status) => {
                        let sequence = Promise.resolve();
                        if (status === "canceled" && promise && typeof promise[cancelSymbol] === "function") {
                            sequence = sequence.then(() => (<Cancellable<U>>promise)[cancelSymbol]());
                        }
                        sequence = sequence.then(() => this.context._removeFromQueue(output));
                        if (options.revert) {
                            sequence = sequence.then(() => options.revert(status));
                        }
                        return sequence;
                    },
                    context: this.context
                });
            return output;
        }

        catch<U>(onrejected?: (error: any) => U | PromiseLike<U>, options?: CancellableOptionBag) {
            return this.then(undefined, onrejected, options);
        }
    }

    // better name? this can be used when a single contract only is needed
    export class AsyncFeed<T> extends Cancellable<T> {
        constructor(init: (resolve: (value?: T | PromiseLike<T>) => Promise<void>, reject: (reason?: any) => Promise<void>, controller: CancellableController) => void, options: CancellableOptionBag) {
            let newThis = window.SubclassJ ? SubclassJ.getNewThis(AsyncFeed, Cancellable, [init, options]) : this;
            if (!window.SubclassJ) {
                super(init, options);
            }
            return newThis;
        }
        cancel(): Promise<void> {
            return this[cancelSymbol]();
        }
    }
}
