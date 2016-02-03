var Cancellables;
(function (Cancellables) {
    var util;
    (function (util) {
        function assign(target, ...sources) {
            if (Object.assign)
                return (Object.assign)(target, ...sources);
            for (let source of sources) {
                source = Object(source);
                for (let property in source) {
                    target[property] = source[property];
                }
            }
            return target;
        }
        util.assign = assign;
    })(util || (util = {}));
    Cancellables.cancellation = new Proxy(() => { }, {
        set: () => false,
        get: (target, property) => property !== "then" ? Cancellables.cancellation : undefined,
        construct: () => Cancellables.cancellation,
        apply: () => Cancellables.cancellation
    });
    Cancellables.cancelSymbol = Symbol("cancel");
    class Cancellable extends Promise {
        constructor(init, options) {
            options = util.assign({}, options); // pass cancellation by default
            // unable to use `this` before super call completes so make a temp object instead            
            let internal = {};
            super((resolve, reject) => {
                internal.resolve = resolve; // newThis is unavailable at construction
                internal.reject = reject;
                internal.modifiable = true;
                internal.canceled = false;
                internal.options = options;
                let controller = {
                    get canceled() { return this._canceled; },
                    confirmCancellation: () => {
                        internal.options.deferCancellation = false;
                        internal.canceled = true;
                        return this._resolveCancel();
                    }
                };
                try {
                    init((value) => {
                        if (!internal.modifiable) {
                            return;
                        }
                        internal.modifiable = false; // newThis may not be obtained yet but every assignation will be reassigned after obtaining
                        let sequence = Promise.resolve();
                        if (internal.options && internal.options.revert) {
                            sequence = sequence.then(() => internal.options.revert("resolved"));
                        }
                        return sequence.then(() => resolve(value)).catch((error) => reject(error)); // reject when revert failed
                    }, (error) => {
                        if (!internal.modifiable) {
                            return;
                        }
                        internal.modifiable = false;
                        let sequence = Promise.resolve();
                        if (internal.options && internal.options.revert) {
                            sequence = sequence.then(() => internal.options.revert("rejected"));
                        }
                        return sequence.then(() => reject(error)).catch((error) => reject(error));
                    }, controller);
                }
                catch (error) {
                    // error when calling init
                    reject(error);
                }
            });
            this._internal = internal;
        }
        get canceled() { return this._internal.canceled; }
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
        [Cancellables.cancelSymbol]() {
            if (!this._internal.modifiable || this._internal.canceled) {
                return Promise.reject(new Error("Already locked"));
            }
            let sequence = Promise.resolve();
            if (this._internal.options.precancel) {
                sequence = sequence.then(() => this._internal.options.precancel());
            }
            sequence = sequence.then(() => { this._internal.canceled = true; });
            if (!this._internal.options.deferCancellation) {
                return sequence.then(() => this._resolveCancel());
            }
            else {
                return sequence.then(() => this.then());
            }
            // Thought: What if Contract goes on after cancelled? [cancel]() will immediately resolve contract but actual process may not be immediately canceled.
            // cancel() should return Promise (not Contract, no cancellation for cancellation)
            // no defer: Promise.resolve
            // defer: should cancellation promise be resolved before target contract? Not sure
        }
        _resolveCancel() {
            this._internal.modifiable = false;
            let sequence = Promise.resolve();
            if (this._internal.options && this._internal.options.revert) {
                sequence = sequence.then(() => this._internal.options.revert("canceled"));
            }
            return sequence.then(() => this._internal.resolve(Cancellables.cancellation)).catch((error) => this._internal.reject(error));
            // won't resolve with Cancellation when already resolved 
        }
    }
    Cancellables.Cancellable = Cancellable;
    class CancellableContext {
        constructor(callback, options) {
            options = util.assign({}, options);
            this._queue = [];
            this._modifiable = true;
            this._canceled = false;
            this._feeder = new CancellableFeed((resolve, reject, controller) => {
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
                    return item[Cancellables.cancelSymbol]();
                }
            })).then();
            // for (let item of this[queueKey]) {
            //     (<Contract<any>>item)[cancelKey]();
            // }
        }
        /* TODO: `options` should be utilized */
        queue(callback, options) {
            let promise;
            if (typeof callback === "function") {
                promise = Promise.resolve().then(() => callback()); // promise will be rejected gracely when callback() fails
            }
            let output = new AsyncQueueItem((resolve, reject) => {
                // resolve/reject must be called after whole promise chain is resolved
                // so that the queue item keep being modifiable until resolving whole chain 
                Promise.resolve(promise).then(resolve, reject);
            }, {
                revert: (status) => {
                    if (status === "canceled" && promise && typeof promise[Cancellables.cancelSymbol] === "function") {
                        promise[Cancellables.cancelSymbol]();
                    }
                    this._removeFromQueue(output);
                },
                context: this
            });
            this._queue.push(output);
            return output; // return an object that support chaining
        }
        _removeFromQueue(item) {
            let queueIndex = this._queue.indexOf(item);
            this._queue.splice(queueIndex, 1);
        }
        feed() {
            return this._feeder;
        }
        get canceled() {
            return this._feeder._internal.canceled || this._canceled;
        }
        resolve(value) {
            this._modifiable = false;
            return this._resolveFeeder(value);
        }
        reject(error) {
            this._modifiable = false;
            return this._rejectFeeder(error);
        }
        cancel() {
            this._canceled = true;
            return this._feederController.confirmCancellation();
        }
    }
    Cancellables.CancellableContext = CancellableContext;
    // Can chaining characteristics of AsyncQueueItem be used generally? 
    class AsyncQueueItem extends Cancellable {
        constructor(init, options) {
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
        get context() { return this._context; }
        queue(onfulfilled, options) {
            options = util.assign({ behaviorOnCancellation: "pass" }, options);
            return this.then(onfulfilled, undefined, options);
        }
        then(onfulfilled, onrejected, options) {
            options = util.assign({ behaviorOnCancellation: "none" }, options);
            let resolver;
            let resolveWithCancellationCheck = (value) => {
                /*
                What should happen when previous queue is resolved after context cancellation?
                1. check cancellation and resolve with Cancellation object
                
                Cancellation cancellation cancellation... processing cancellation is too hard then. (if queue chain ever uses arguments)
                - fixed by behaviorOnCancellation: "pass"
                - still too long, should it be default value for queue items?
                - okay, make it default
                */
                if (this.context.canceled && !this._cancellationAwared) {
                    value = Cancellables.cancellation;
                    output._cancellationAwared = true;
                }
                if (value === Cancellables.cancellation) {
                    if (options.behaviorOnCancellation === "silent") {
                        return new Promise(() => { }); // never resolve
                    }
                    else if (options.behaviorOnCancellation === "pass") {
                        return Cancellables.cancellation; // never call onfulfilled
                    }
                }
                let result;
                try {
                    if (typeof onfulfilled === "function") {
                        result = onfulfilled(value);
                    }
                }
                catch (e) {
                    result = Promise.reject(e);
                }
                return result;
                // resolve should be called only when full promise chain is resolved
                // so that .revert can only be called when all is over 
            };
            let output = super.then((value) => {
                this.context._queue.push(output);
                return resolver = resolveWithCancellationCheck(value);
            }, (error) => {
                this.context._queue.push(output);
                if (this.context.canceled) {
                    return resolveWithCancellationCheck();
                }
                let result;
                try {
                    if (typeof onrejected === "function") {
                        result = onrejected(error);
                    }
                }
                catch (e) {
                    result = Promise.reject(e);
                }
                return resolver = result;
            });
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
                    if (status === "canceled" && resolver && typeof resolver[Cancellables.cancelSymbol] === "function") {
                        sequence = sequence.then(() => resolver[Cancellables.cancelSymbol]());
                    }
                    sequence = sequence.then(() => this.context._removeFromQueue(output));
                    if (options.revert) {
                        sequence = sequence.then(() => options.revert(status));
                    }
                    return sequence;
                }
            };
            output._context = this.context;
            return output;
        }
        catch(onrejected, options) {
            return this.then(undefined, onrejected, options);
        }
    }
    Cancellables.AsyncQueueItem = AsyncQueueItem;
    // better name? this can be used when a single contract only is needed
    class CancellableFeed extends Cancellable {
        cancel() {
            return this[Cancellables.cancelSymbol]();
        }
    }
    Cancellables.CancellableFeed = CancellableFeed;
})(Cancellables || (Cancellables = {}));
//# sourceMappingURL=cancellables.js.map
if (typeof module !== "undefined" && module.exports) {
    module.exports = Cancellables;
}