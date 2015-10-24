var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var AsyncChainer;
(function (AsyncChainer) {
    var util;
    (function (util) {
        function assign(target) {
            var sources = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                sources[_i - 1] = arguments[_i];
            }
            if (Object.assign)
                return (_a = Object).assign.apply(_a, [target].concat(sources));
            for (var _b = 0; _b < sources.length; _b++) {
                var source = sources[_b];
                source = Object(source);
                for (var property in source) {
                    target[property] = source[property];
                }
            }
            return target;
            var _a;
        }
        util.assign = assign;
    })(util || (util = {}));
    var globalObject;
    if (typeof self !== "undefined") {
        globalObject = self;
    }
    else if (typeof global !== "undefined") {
        globalObject = global;
    }
    var symbolFunction = globalObject.Symbol;
    var symbolSupported = typeof symbolFunction === "function" && typeof symbolFunction() === "symbol";
    function generateSymbolKey(key) {
        if (symbolSupported) {
            return symbolFunction(key);
        }
        return btoa(Math.random().toFixed(16));
    }
    AsyncChainer.Cancellation = new Proxy(function () { }, {
        set: function () { return false; },
        get: function (target, property) { return property !== "then" ? AsyncChainer.Cancellation : undefined; },
        construct: function () { return AsyncChainer.Cancellation; },
        apply: function () { return AsyncChainer.Cancellation; }
    });
    /*
        Keys for Contract class
    */
    var resolveKey = generateSymbolKey("resolve");
    var rejectKey = generateSymbolKey("reject");
    var cancelKey = generateSymbolKey("cancel");
    var resolveCancelKey = generateSymbolKey("cancel-resolve");
    var modifiableKey = generateSymbolKey("modifiable");
    var revertKey = generateSymbolKey("revert");
    var canceledKey = generateSymbolKey("canceled");
    var thisKey = generateSymbolKey("this");
    var optionsKey = generateSymbolKey("options");
    /*
        Keys for AsyncContext
    */
    var feederKey = generateSymbolKey("feeder");
    var resolveFeederKey = generateSymbolKey("resolve-feeder");
    var rejectFeederKey = generateSymbolKey("reject-feeder");
    var feederControllerKey = generateSymbolKey("feeder-controller");
    var queueKey = generateSymbolKey("queue");
    var cancelAllKey = generateSymbolKey("cancel-all");
    var removeFromQueueKey = generateSymbolKey("remove-from-queue");
    /*
        Keys for AsyncQueueItem
    */
    var contextKey = generateSymbolKey("context");
    var cancellationAwaredKey = generateSymbolKey("cancellation-awared");
    var Contract = (function (_super) {
        __extends(Contract, _super);
        function Contract(init, options) {
            var _this = this;
            if (options === void 0) { options = {}; }
            options = util.assign({}, options); // pass cancellation by default
            var revert = options.revert;
            var newThis = this; // only before getting real newThis
            var controller = {
                get canceled() { return newThis[canceledKey]; },
                confirmCancellation: function () {
                    _this[optionsKey].deferCancellation = false;
                    _this[canceledKey] = true;
                    return _this[resolveCancelKey]();
                }
            };
            var listener = function (resolve, reject) {
                _this[resolveKey] = resolve; // newThis is unavailable at construction
                _this[rejectKey] = reject;
                _this[revertKey] = revert;
                _this[modifiableKey] = true;
                _this[canceledKey] = false;
                _this[optionsKey] = options;
                try {
                    init(function (value) {
                        if (!newThis[modifiableKey]) {
                            return;
                        }
                        newThis[modifiableKey] = false; // newThis may not be obtained yet but every assignation will be reassigned after obtaining
                        var sequence = Promise.resolve();
                        if (revert) {
                            sequence = sequence.then(function () { return revert("resolved"); });
                        }
                        return sequence.then(function () { return resolve(value); }).catch(function (error) { return reject(error); }); // reject when revert failed
                    }, function (error) {
                        if (!newThis[modifiableKey]) {
                            return;
                        }
                        newThis[modifiableKey] = false;
                        var sequence = Promise.resolve();
                        if (revert) {
                            sequence = sequence.then(function () { return revert("rejected"); });
                        }
                        return sequence.then(function () { return reject(error); }).catch(function (error) { return reject(error); });
                    }, controller);
                }
                catch (error) {
                    // error when calling init
                    reject(error);
                }
            };
            newThis = window.SubclassJ ? SubclassJ.getNewThis(Contract, Promise, [listener]) : this;
            if (!window.SubclassJ) {
                _super.call(this, listener);
            }
            newThis[resolveKey] = this[resolveKey];
            newThis[rejectKey] = this[rejectKey];
            // guarantee every assignation before obtaining newThis be applied on it
            newThis[revertKey] = this[revertKey];
            newThis[modifiableKey] = this[modifiableKey];
            newThis[canceledKey] = this[canceledKey];
            newThis[optionsKey] = this[optionsKey];
            return newThis;
            //super(listener);
        }
        Object.defineProperty(Contract.prototype, "canceled", {
            get: function () { return this[canceledKey]; },
            enumerable: true,
            configurable: true
        });
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
        Contract.prototype[cancelKey] = function () {
            var _this = this;
            if (!this[modifiableKey] || this[canceledKey]) {
                return Promise.reject(new Error("Already locked"));
            }
            this[canceledKey] = true;
            var sequence = Promise.resolve();
            if (this[optionsKey].precancel) {
                sequence = sequence.then(function () { return _this[optionsKey].precancel(); });
            }
            if (!this[optionsKey].deferCancellation) {
                return sequence.then(function () { return _this[resolveCancelKey](); });
            }
            else {
                return sequence.then(function () { return _this.then(); });
            }
            // Thought: What if Contract goes on after cancelled? [cancel]() will immediately resolve contract but actual process may not be immediately canceled.
            // cancel() should return Promise (not Contract, no cancellation for cancellation)
            // no defer: Promise.resolve
            // defer: should cancellation promise be resolved before target contract? Not sure
        };
        Contract.prototype[resolveCancelKey] = function () {
            var _this = this;
            this[modifiableKey] = false;
            var sequence = Promise.resolve();
            if (this[revertKey]) {
                sequence = sequence.then(function () { return _this[revertKey]("canceled"); });
            }
            return sequence.then(function () { return _this[resolveKey](AsyncChainer.Cancellation); }).catch(function (error) { return _this[rejectKey](error); });
            // won't resolve with Cancellation when already resolved 
        };
        return Contract;
    })(Promise);
    AsyncChainer.Contract = Contract;
    var AsyncContext = (function () {
        function AsyncContext(callback, options) {
            var _this = this;
            if (options === void 0) { options = {}; }
            options = util.assign({}, options);
            this[queueKey] = [];
            this[modifiableKey] = true;
            this[canceledKey] = false;
            this[feederKey] = new AsyncFeed(function (resolve, reject, controller) {
                _this[resolveFeederKey] = resolve;
                _this[rejectFeederKey] = reject;
                _this[feederControllerKey] = controller;
            }, {
                revert: function (status) {
                    _this[modifiableKey] = false;
                    var sequence = Promise.resolve();
                    if (status !== "canceled") {
                        sequence = sequence.then(function () { return _this[cancelAllKey](); });
                    }
                    return sequence.then(function () {
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
                precancel: function () {
                    // still modifiable at the time of precancel
                    return Promise.resolve().then(function () {
                        if (options.precancel) {
                            return options.precancel();
                        }
                    }).then(function () { return _this[cancelAllKey](); });
                },
                deferCancellation: options.deferCancellation
            });
            Promise.resolve().then(function () { return callback(_this); }).catch(function (error) { return _this[rejectFeederKey](error); });
        }
        AsyncContext.prototype[cancelAllKey] = function () {
            return Promise.all(this[queueKey].map(function (item) {
                if (item[modifiableKey] && !item[canceledKey]) {
                    return item[cancelKey]();
                }
            }));
            // for (let item of this[queueKey]) {
            //     (<Contract<any>>item)[cancelKey]();
            // }
        };
        AsyncContext.prototype.queue = function (callback, options) {
            var _this = this;
            if (options === void 0) { options = {}; }
            var promise;
            if (typeof callback === "function") {
                promise = Promise.resolve().then(function () { return callback(); }); // promise will be rejected gracely when callback() fails
            }
            var output = new AsyncQueueItem(function (resolve, reject) {
                // resolve/reject must be called after whole promise chain is resolved
                // so that the queue item keep being modifiable until resolving whole chain 
                Promise.resolve(promise).then(resolve, reject);
            }, {
                revert: function (status) {
                    if (status === "canceled" && promise && typeof promise[cancelKey] === "function") {
                        promise[cancelKey]();
                    }
                    _this[removeFromQueueKey](output);
                },
                context: this
            });
            this[queueKey].push(output);
            return output; // return an object that support chaining
        };
        AsyncContext.prototype[removeFromQueueKey] = function (item) {
            var queueIndex = this[queueKey].indexOf(item);
            this[queueKey].splice(queueIndex, 1);
        };
        AsyncContext.prototype.feed = function () {
            return this[feederKey];
        };
        Object.defineProperty(AsyncContext.prototype, "canceled", {
            get: function () {
                return this[feederKey][canceledKey] || this[canceledKey];
            },
            enumerable: true,
            configurable: true
        });
        AsyncContext.prototype.resolve = function (value) {
            this[modifiableKey] = false;
            return this[resolveFeederKey](value);
        };
        AsyncContext.prototype.reject = function (error) {
            this[modifiableKey] = false;
            return this[rejectFeederKey](error);
        };
        AsyncContext.prototype.cancel = function () {
            this[canceledKey] = true;
            return this[feederControllerKey].confirmCancellation();
        };
        return AsyncContext;
    })();
    AsyncChainer.AsyncContext = AsyncContext;
    // Can chaining characteristics of AsyncQueueItem be used generally? 
    var AsyncQueueItem = (function (_super) {
        __extends(AsyncQueueItem, _super);
        function AsyncQueueItem(init, options) {
            if (!(options.context instanceof AsyncContext)) {
                throw new Error("An AsyncContext object must be given by `options.context`.");
            }
            var newThis = window.SubclassJ ? SubclassJ.getNewThis(AsyncQueueItem, Contract, [init, options]) : this;
            if (!window.SubclassJ) {
                _super.call(this, init, options);
            }
            newThis[contextKey] = this[contextKey] = options.context;
            newThis[cancellationAwaredKey] = this[cancellationAwaredKey] = false;
            return newThis;
        }
        Object.defineProperty(AsyncQueueItem.prototype, "context", {
            get: function () { return this[contextKey]; },
            enumerable: true,
            configurable: true
        });
        AsyncQueueItem.prototype.queue = function (onfulfilled, options) {
            if (options === void 0) { options = {}; }
            options = util.assign({ behaviorOnCancellation: "pass" }, options);
            return this.then(onfulfilled, undefined, options);
        };
        AsyncQueueItem.prototype.then = function (onfulfilled, onrejected, options) {
            var _this = this;
            if (options === void 0) { options = {}; }
            var promise;
            options = util.assign({ behaviorOnCancellation: "none" }, options);
            var output = new AsyncQueueItem(function (resolve, reject) {
                var resolveWithCancellationCheck = function (value) {
                    /*
                    What should happen when previous queue is resolved after context cancellation?
                    1. check cancellation and resolve with Cancellation object
                    
                    Cancellation cancellation cancellation... processing cancellation is too hard then. (if queue chain ever uses arguments)
                    - fixed by behaviorOnCancellation: "pass"
                    - still too long, should it be default value for queue items?
                    - okay, make it default
                    */
                    if (_this.context.canceled && !_this[cancellationAwaredKey]) {
                        value = AsyncChainer.Cancellation;
                        output[cancellationAwaredKey] = true;
                    }
                    if (value === AsyncChainer.Cancellation) {
                        if (options.behaviorOnCancellation === "silent") {
                            return; // never resolve
                        }
                        else if (options.behaviorOnCancellation === "pass") {
                            resolve(AsyncChainer.Cancellation);
                            return; // never call onfulfilled
                        }
                    }
                    if (typeof onfulfilled === "function") {
                        promise = Promise.resolve().then(function () { return onfulfilled(value); }); // gracely reject when fail
                    }
                    Promise.resolve(promise).then(resolve, reject);
                    // resolve should be called only when full promise chain is resolved
                    // so that .revert can only be called when all is over 
                };
                _super.prototype.then.call(_this, function (value) {
                    _this.context[queueKey].push(output);
                    resolveWithCancellationCheck(value);
                }, function (error) {
                    _this.context[queueKey].push(output);
                    if (_this.context.canceled) {
                        resolveWithCancellationCheck();
                        return; // no onrejected call when canceled
                    }
                    if (typeof onrejected === "function") {
                        promise = Promise.resolve().then(function () { return onrejected(error); });
                    }
                    Promise.resolve(promise).then(resolve, reject);
                });
            }, {
                revert: function (status) {
                    var sequence = Promise.resolve();
                    if (status === "canceled" && promise && typeof promise[cancelKey] === "function") {
                        sequence = sequence.then(function () { return promise[cancelKey](); });
                    }
                    sequence = sequence.then(function () { return _this.context[removeFromQueueKey](output); });
                    if (options.revert) {
                        sequence = sequence.then(function () { return options.revert(status); });
                    }
                    return sequence;
                },
                context: this.context
            });
            return output;
        };
        AsyncQueueItem.prototype.catch = function (onrejected, options) {
            if (options === void 0) { options = {}; }
            return this.then(undefined, onrejected, options);
        };
        return AsyncQueueItem;
    })(Contract);
    AsyncChainer.AsyncQueueItem = AsyncQueueItem;
    // better name? this can be used when a single contract only is needed
    var AsyncFeed = (function (_super) {
        __extends(AsyncFeed, _super);
        function AsyncFeed(init, options) {
            if (options === void 0) { options = {}; }
            var newThis = window.SubclassJ ? SubclassJ.getNewThis(AsyncFeed, Contract, [init, options]) : this;
            if (!window.SubclassJ) {
                _super.call(this, init, options);
            }
            return newThis;
        }
        AsyncFeed.prototype.cancel = function () {
            return this[cancelKey]();
        };
        return AsyncFeed;
    })(Contract);
    AsyncChainer.AsyncFeed = AsyncFeed;
})(AsyncChainer || (AsyncChainer = {}));
//# sourceMappingURL=async-context.js.map
if (typeof module !== "undefined" && module.exports) {
    module.exports.default = AsyncChainer;
}