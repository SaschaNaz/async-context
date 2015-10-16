module AsyncChainer {
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


    let symbolFunction = (<any>window).Symbol;
    let symbolSupported = typeof symbolFunction === "function" && typeof symbolFunction() === "symbol";
    function generateSymbolKey(key: string) {
        if (symbolSupported) {
            return symbolFunction(key);
        }
        return btoa(Math.random().toFixed(16));
    }

    export var Cancellation: any = new Proxy(() => { }, {
        set: () => false,
        get: (target, property) => property !== "then" ? Cancellation : undefined, // non-thenable 
        construct: () => Cancellation,
        apply: () => Cancellation
    });

    /*
        Keys for Contract class 
    */
    let resolveKey = generateSymbolKey("resolve");
    let rejectKey = generateSymbolKey("reject");
    let cancelKey = generateSymbolKey("cancel");
    let resolveCancelKey = generateSymbolKey("cancel-resolve");
    let modifiableKey = generateSymbolKey("modifiable");
    let revertKey = generateSymbolKey("revert");
    let canceledKey = generateSymbolKey("canceled");
    let thisKey = generateSymbolKey("this");
    let optionsKey = generateSymbolKey("options");

    /*
        Keys for AsyncContext
    */
    let feederKey = generateSymbolKey("feeder");
    let resolveFeederKey = generateSymbolKey("resolve-feeder");
    let rejectFeederKey = generateSymbolKey("reject-feeder");
    let feederControllerKey = generateSymbolKey("feeder-controller")
    let queueKey = generateSymbolKey("queue");
    let cancelAllKey = generateSymbolKey("cancel-all")
    let removeFromQueueKey = generateSymbolKey("remove-from-queue");

    /*
        Keys for AsyncQueueItem
    */
    let contextKey = generateSymbolKey("context");

    export interface ContractOptionBag {
        /** Reverting listener for a contract. This will always be called after a contract gets finished in any status. */
        revert?: (status: string) => void | Thenable<void>;
        // silentOnCancellation?: boolean;
        // How about returning Cancellation object automatically cancel chained contracts? - What about promises then? Unintuitive.

        // do nothing but just pass Cancellation object when it receives it 
        // passCancellation?: boolean;

        // for async cancellation process
        deferCancellation?: boolean;
    }

    export interface ContractController {
        canceled: boolean;
        confirmCancellation: () => Promise<void>;
    }

    export class Contract<T> extends Promise<T> {
        get canceled() { return <boolean>this[canceledKey] }

        constructor(init: (resolve: (value?: T | Thenable<T>) => Promise<void>, reject: (reason?: any) => Promise<void>, controller: ContractController) => void, options: ContractOptionBag = {}) {
            options = util.assign<ContractOptionBag>({}, options); // pass cancellation by default
            let {revert} = options;
            let newThis = this; // only before getting real newThis
            let controller: ContractController = {
                get canceled() { return newThis[canceledKey] },
                confirmCancellation: () => {
                    this[optionsKey].deferCancellation = false;
                    this[canceledKey] = true;
                    return this[resolveCancelKey]();
                }
            }

            let listener = (resolve: (value?: T | Thenable<T>) => void, reject: (error?: any) => void) => {
                this[resolveKey] = resolve; // newThis is unavailable at construction
                this[rejectKey] = reject;
                this[revertKey] = revert;
                this[modifiableKey] = true;
                this[canceledKey] = false;
                this[optionsKey] = options;

                init(
                    (value) => {
                        if (!newThis[modifiableKey]) {
                            return;
                        }
                        newThis[modifiableKey] = false; // newThis may not be obtained yet but every assignation will be reassigned after obtaining
                        let sequence = Promise.resolve<void>();
                        if (revert) {
                            sequence = sequence.then(() => revert("resolved"));
                        }
                        return sequence.then(() => resolve(value)).catch((error) => reject(error)); // reject when revert failed
                    },
                    (error) => {
                        if (!newThis[modifiableKey]) {
                            return;
                        }
                        newThis[modifiableKey] = false;
                        let sequence = Promise.resolve<void>();
                        if (revert) {
                            sequence = sequence.then(() => revert("rejected"));
                        }
                        return sequence.then(() => reject(error)).catch((error) => reject(error));
                    },
                    controller
                )
            };

            newThis = window.SubclassJ ? SubclassJ.getNewThis(Contract, Promise, [listener]) : this;
            if (!window.SubclassJ) {
                super(listener);
            }

            newThis[resolveKey] = this[resolveKey];
            newThis[rejectKey] = this[rejectKey];

            // guarantee every assignation before obtaining newThis be applied on it
            newThis[revertKey] = this[revertKey]
            newThis[modifiableKey] = this[modifiableKey];
            newThis[canceledKey] = this[canceledKey];
            newThis[optionsKey] = this[optionsKey];

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

        [cancelKey]() {
            if (!this[modifiableKey]) {
                return Promise.reject(new Error("Already locked"));
            }
            this[canceledKey] = true;
            if (!this[optionsKey].deferCancellation) {
                return this[resolveCancelKey]();
            }
            else {
                return this.then<void>();
            }
            // Thought: What if Contract goes on after cancelled? [cancel]() will immediately resolve contract but actual process may not be immediately canceled.
            // cancel() should return Promise (not Contract, no cancellation for cancellation)

            // no defer: Promise.resolve
            // defer: should cancellation promise be resolved before target contract? Not sure
        }

        [resolveCancelKey]() {
            this[modifiableKey] = false;
            let sequence = Promise.resolve<void>();
            if (this[revertKey]) {
                sequence = sequence.then(() => this[revertKey]("canceled"));
            }
            return sequence.then(() => this[resolveKey](Cancellation)).catch((error) => this[rejectKey](error));
            // won't resolve with Cancellation when already resolved 
        }
    }

    export class AsyncContext<T> {
        constructor(callback: (context: AsyncContext<T>) => any, options: ContractOptionBag = {}) {
            options = util.assign<ContractOptionBag>({}, options);
            this[queueKey] = [];
            this[modifiableKey] = true;
            this[canceledKey] = false;
            this[feederKey] = new AsyncFeed((resolve, reject, controller) => {
                this[resolveFeederKey] = resolve;
                this[rejectFeederKey] = reject;
                this[feederControllerKey] = controller;
            }, {
                revert: (status) => {
                    this[modifiableKey] = false;

                    return this[cancelAllKey]().then(() => {
                        if (options.revert) {
                            return options.revert(status);
                        }
                    });
                },
                deferCancellation: options.deferCancellation
            });
            Promise.resolve().then(() => callback(this));
        }

        [cancelAllKey]() {
            return Promise.all((<AsyncQueueItem<any>[]>this[queueKey]).map((item) => {
                if (item[modifiableKey]) {
                    return item[cancelKey]()
                }
            }))

            // for (let item of this[queueKey]) {
            // 	(<Contract<any>>item)[cancelKey]();
            // }
        }

        queue<U>(callback?: () => U | Thenable<U>, options: ContractOptionBag = {}) {
            let promise: U | Thenable<U>
            if (typeof callback === "function") {
                promise = callback();
            }
            let output = new AsyncQueueItem<U>((resolve, reject) => {
                // resolve/reject must be called after whole promise chain is resolved
                // so that the queue item keep being modifiable until resolving whole chain 
                Promise.resolve(promise).then(resolve, reject);
            }, {
                revert: (status) => {
                    if (status === "canceled" && promise && typeof promise[cancelKey] === "function") {
                        (<Contract<U>>promise)[cancelKey]();
                    }
                    this[removeFromQueueKey](output);
                },
                context: this
            });
            this[queueKey].push(output);
            return output; // return an object that support chaining
        }

        [removeFromQueueKey](item: AsyncQueueItem<any>) {
            let queueIndex = this[queueKey].indexOf(item);
            (<AsyncQueueItem<any>[]>this[queueKey]).splice(queueIndex, 1);
        }

        feed() {
            return <AsyncFeed<T>>this[feederKey];
        }

        get canceled() {
            return <boolean>this[feederKey][canceledKey] || <boolean>this[canceledKey];
        }

        resolve(value?: T): Promise<void> {
            this[modifiableKey] = false;
            return this[resolveFeederKey](value);
        }
        reject(error?: any): Promise<void> {
            this[modifiableKey] = false;
            return this[rejectFeederKey](error);
        }
        cancel(): Promise<void> {
            this[canceledKey] = true;
            return this[feederControllerKey].confirmCancellation();
        }
    }

    export interface AsyncQueueConstructionOptionBag extends ContractOptionBag {
        context: AsyncContext<any>;
    }

    export interface AsyncQueueOptionBag extends ContractOptionBag {
        behaviorOnCancellation?: string; // "pass"(default), "silent", "none"
    }

    // Can chaining characteristics of AsyncQueueItem be used generally? 
    export class AsyncQueueItem<T> extends Contract<T> {
        get context() { return <AsyncContext<any>>this[contextKey] }

        constructor(init: (resolve: (value?: T | Thenable<T>) => void, reject: (reason?: any) => void) => void, options: AsyncQueueConstructionOptionBag) {
            if (!(options.context instanceof AsyncContext)) {
                throw new Error("An AsyncContext object must be given by `options.context`.");
            }
            let newThis = window.SubclassJ ? SubclassJ.getNewThis(AsyncQueueItem, Contract, [init, options]) : this;
            if (!window.SubclassJ) {
                super(init, options);
            }

            newThis[contextKey] = this[contextKey] = options.context;
            return newThis;
        }

        then<U>(onfulfilled?: (value: T) => U | Thenable<U>, options: AsyncQueueOptionBag = {}) {
            let promise: U | Thenable<U>;
            options = util.assign<any>({ behaviorOnCancellation: "pass" }, options);

            let output = new AsyncQueueItem<U>((resolve, reject) => {
                super.then((value) => {
                    this.context[queueKey].push(output);
                    /*
                    What should happen when previous queue is resolved after context cancellation?
                    1. check cancellation and resolve with Cancellation object
                    
                    Cancellation cancellation cancellation... processing cancellation is too hard then. (if queue chain ever uses arguments)
                    - fixed by behaviorOnCancellation: "pass"
                    - still too long, should it be default value for queue items?
                    - okay, make it default
                    */
                    if (this.context.canceled) {
                        value = Cancellation;
                    }
                    if (value === Cancellation) {
                        if (options.behaviorOnCancellation === "silent") {
                            return; // never resolve
                        }
                        else if (options.behaviorOnCancellation === "pass") {
                            resolve(Cancellation);
                            return; // never call onfulfilled
                        }
                    }
                    if (typeof onfulfilled === "function") {
                        promise = onfulfilled(value);
                    }
                    Promise.resolve(promise).then(resolve, reject);
                })
            }, {
                revert: (status) => {
                    let sequence = Promise.resolve<void>();
                    if (status === "canceled" && promise && typeof promise[cancelKey] === "function") {
                        sequence = sequence.then(() => (<Contract<U>>promise)[cancelKey]());
                    }
                    sequence = sequence.then(() => this.context[removeFromQueueKey](output));
                    if (options.revert) {
                        sequence = sequence.then(() => options.revert(status));
                    }
                    return sequence;
                },
                context: this.context
            });
            return output;
        }

        catch<U>(onrejected?: (error: any) => U | Thenable<U>, options: ContractOptionBag = {}) {
            let promise: U | Thenable<U>;

            let output = new AsyncQueueItem((resolve, reject) => {
                super.catch((error) => {
                    if (this.context.canceled) {
                        resolve(Cancellation);
                        return; // no catch when canceled
                    }
                    if (typeof onrejected === "function") {
                        promise = onrejected(error);
                    }
                    resolve(promise);
                })
            }, {
                revert: () => {
                    let sequence = Promise.resolve<void>();
                    if (promise && typeof promise[cancelKey] === "function") {
                        sequence = sequence.then(() => (<Contract<U>>promise)[cancelKey]());
                    }
                    sequence = sequence.then(() => this.context[removeFromQueueKey](output));
                    if (options.revert) {
                        sequence = sequence.then(() => options.revert(status));
                    }
                    return sequence;
                },
                context: this.context
            });
            this.context[queueKey].push(output);
            return output;
        }
    }

    // better name? this can be used when a single contract only is needed
    export class AsyncFeed<T> extends Contract<T> {
        constructor(init: (resolve: (value?: T | Thenable<T>) => Promise<void>, reject: (reason?: any) => Promise<void>, controller: ContractController) => void, options: ContractOptionBag = {}) {
            let newThis = window.SubclassJ ? SubclassJ.getNewThis(AsyncFeed, Contract, [init, options]) : this;
            if (!window.SubclassJ) {
                super(init, options);
            }
            return newThis;
        }
        cancel() {
            return this[cancelKey]();
        }
    }
}