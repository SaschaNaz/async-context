module AsyncChainer {
	let symbolFunction = (<any>window).Symbol;
    let symbolSupported = typeof symbolFunction === "function" && typeof symbolFunction() === "symbol";
    function generateSymbolKey(key: string) {
        if (symbolSupported) {
            return symbolFunction(key);
        }
        return btoa(Math.random().toFixed(16));
    }
	
	export var Cancellation: any = new Proxy(() => {}, { set: () => false, get: () => Cancellation, construct: () => Cancellation, apply: () => Cancellation });
	
	/*
		Keys for Contract class 
	*/
    let resolveKey = generateSymbolKey("resolve");
    //let rejectKey = generateSymbolKey("reject");
    let cancelKey = generateSymbolKey("cancel");
    let modifiableKey = generateSymbolKey("modifiable");
	let revertKey = generateSymbolKey("revert");
	let canceledKey = generateSymbolKey("canceled");
	let thisKey = generateSymbolKey("this");

	/*
		Keys for AsyncContext
	*/
    let feederKey = generateSymbolKey("feeder");
    let resolveFeederKey = generateSymbolKey("resolve-feeder");
    let rejectFeederKey = generateSymbolKey("reject-feeder");
    let queueKey = generateSymbolKey("queue");
	let cancelAllKey = generateSymbolKey("cancel-all")
	let removeFromQueueKey = generateSymbolKey("remove-from-queue");
	
	/*
		Keys for AsyncQueueItem
	*/
	let contextKey = generateSymbolKey("context");
	
	export interface ContractOptionBag {
	/** Reverting listener for a contract. This will always be called after a contract gets finished in any status. */
		revert?: (status: string) => void;
	}
		
	export class Contract<T> extends Promise<T> {
		get canceled() { return <boolean>this[canceledKey] }
		
		constructor(init: (resolve: (value?: T | Thenable<T>) => void, reject: (reason?: any) => void) => void, options: ContractOptionBag = {}) {
			let {revert} = options;
			let listener = (resolve : (value?: T | Thenable<T>) => void, reject: (error?: any) => void) => {
				this[resolveKey] = resolve; 
				init(
					(value) => {
						if (!this[modifiableKey]) {
							return;
						}
						this[modifiableKey] = false;
						if (revert) {
							revert("resolved");
						}
						resolve(value);
					},
					(error) => {
						if (!this[modifiableKey]) {
							return;
						}
						this[modifiableKey] = false;
						if (revert) {
							revert("rejected");
						}
						reject(error);
					}
				)
			};
			
			var newThis = window.SubclassJ ? SubclassJ.getNewThis(Contract, Promise, [listener]) : this;
			if (!window.SubclassJ) {
				super(listener);
			}
			
			newThis[resolveKey] = this[resolveKey];
			newThis[revertKey] = this[revertKey] = revert;
			newThis[modifiableKey] = this[modifiableKey] = true;
			newThis[canceledKey] =  this[canceledKey] = false;
			
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
				return;
			}
			this[modifiableKey] = false;
			this[canceledKey] = true;
			if (this[revertKey]) {
				this[revertKey]("canceled");
			}
			this[resolveKey](Cancellation);
		}
	}
	
	export class AsyncContext<T> {
		constructor(callback: (context: AsyncContext<T>) => any) {
			this[queueKey] = [];
			this[canceledKey] = false;
			this[feederKey] = new AsyncFeed((resolve, reject) => {
				this[resolveFeederKey] = resolve;
				this[rejectFeederKey] = reject;
			}, {
				revert: () => {
					this[cancelAllKey]();
				}
			});
			Promise.resolve().then(() => callback(this));
		}
		
		[cancelAllKey]() {
			for (let item of this[queueKey]) {
				(<Contract<any>>item)[cancelKey]();
			}
		}
		
		queue<U>(callback?: () => U | Thenable<U>, options: ContractOptionBag = {}) {
			let promise: U | Thenable<U>
			if (typeof callback === "function") {
				promise = callback();
			}
			let output = new AsyncQueueItem<U>((resolve, reject) => {
				// resolve function automatically resolves non-thenable object, rejecting promise, etc.
				resolve(promise);
			}, {
				revert: () => {
					if (promise && typeof promise[cancelKey] === "function") {
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
			return <boolean>this[canceledKey];
		}
		
		resolve(value?: T): void {
			this[resolveFeederKey](value);
		}
		reject(error?: any): void {
			this[rejectFeederKey](error);
		}
		cancel(): void {
			this[canceledKey] = true;
			this[resolveFeederKey](Cancellation);
		}
	}
	
	export interface AsyncQueueOptionBag extends ContractOptionBag {
		context: AsyncContext<any>;
	}
	
	// Can chaining characteristics of AsyncQueueItem be used generally? 
	export class AsyncQueueItem<T> extends Contract<T> {
		get context() { return <AsyncContext<any>>this[contextKey] }
		 
		constructor(init: (resolve: (value?: T | Thenable<T>) => void, reject: (reason?: any) => void) => void, options: AsyncQueueOptionBag) {
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
		
		then<U>(onfulfilled?: (value: T) => U | Thenable<U>, options: ContractOptionBag = {}) {
			let promise: U | Thenable<U>;
			
			let output = new AsyncQueueItem<U>((resolve, reject) => {
				super.then((value) => {
					if (typeof onfulfilled === "function") {
						promise = onfulfilled(value);
					}
					resolve(promise);
				})
			}, {
				revert: () => {
					if (promise && typeof promise[cancelKey] === "function") {
						(<Contract<U>>promise)[cancelKey]();
					}
					this.context[removeFromQueueKey](output);
				},
				context: this.context
			});
			this.context[queueKey].push(output);
			return output;
		}
		
		catch<U>(onrejected?: (error: any) => U | Thenable<U>, options: ContractOptionBag = {}) {
			let promise: U | Thenable<U>;
			
			let output = new AsyncQueueItem((resolve, reject) => {
				super.catch((error) => {
					if (typeof onrejected === "function") {
						promise = onrejected(error);
					}
					resolve(promise);
				})
			}, {
				revert: () => {
					if (promise && typeof promise[cancelKey] === "function") {
						(<Contract<U>>promise)[cancelKey]();
					}
					this.context[removeFromQueueKey](output);
				},
				context: this.context
			});
			this.context[queueKey].push(output);
			return output;
		}
	}
	
	// better name? this can be used when a single contract only is needed
	export class AsyncFeed<T> extends Contract<T> {
		constructor(init: (resolve: (value?: T | Thenable<T>) => void, reject: (reason?: any) => void) => void, options: ContractOptionBag = {}) {
			let newThis = window.SubclassJ ? SubclassJ.getNewThis(AsyncFeed, Contract, [init, options]) : this;
			if (!window.SubclassJ) {
				super(init, options);
			}
			return newThis;
		}
		cancel() {
			this[cancelKey]();
		}
	}
}