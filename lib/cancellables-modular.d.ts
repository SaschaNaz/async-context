declare namespace Cancellables {
    var cancellation: any;
    var cancelSymbol: symbol;
    interface CancellableOptionBag {
        /** Reverting listener for a contract. This will always be called after a contract gets finished in any status. */
        revert?: (status: string) => any | PromiseLike<any>;
        deferCancellation?: boolean;
        precancel?: () => any | PromiseLike<any>;
    }
    interface CancellableController {
        canceled: boolean;
        confirmCancellation: () => Promise<void>;
    }
    interface CancellableInternal {
        canceled: boolean;
        modifiable: boolean;
        resolve: <T>(value?: T | PromiseLike<T>) => void;
        reject: (reason?: any) => void;
        options: CancellableOptionBag;
    }
    class Cancellable<T> extends Promise<T> {
        canceled: boolean;
        _internal: CancellableInternal;
        constructor(init: (resolve: (value?: T | PromiseLike<T>) => Promise<void>, reject: (reason?: any) => Promise<void>, controller: CancellableController) => void, options?: CancellableOptionBag);
        _resolveCancel(): Promise<void>;
    }
    class CancellableContext<T> {
        _canceled: boolean;
        _modifiable: boolean;
        _queue: AsyncQueueItem<any>[];
        _feeder: CancellableFeed<T>;
        _feederController: CancellableController;
        _resolveFeeder: <T>(value?: T | PromiseLike<T>) => Promise<void>;
        _rejectFeeder: (reason?: any) => Promise<void>;
        constructor(callback: (context: CancellableContext<T>) => any, options?: CancellableOptionBag);
        _cancelAll(): Promise<void>;
        queue<U>(callback?: () => U | PromiseLike<U>, options?: CancellableOptionBag): AsyncQueueItem<U>;
        _removeFromQueue(item: AsyncQueueItem<any>): void;
        feed(): CancellableFeed<T>;
        canceled: boolean;
        resolve(value?: T): Promise<void>;
        reject(error?: any): Promise<void>;
        cancel(): Promise<void>;
    }
    interface AsyncQueueConstructionOptionBag extends CancellableOptionBag {
        context: CancellableContext<any>;
    }
    interface AsyncQueueOptionBag extends CancellableOptionBag {
        behaviorOnCancellation?: string;
    }
    class AsyncQueueItem<T> extends Cancellable<T> {
        context: CancellableContext<any>;
        _context: CancellableContext<any>;
        _cancellationAwared: boolean;
        constructor(init: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void, options: AsyncQueueConstructionOptionBag);
        queue<U>(onfulfilled?: (value: T) => U | PromiseLike<U>, options?: AsyncQueueOptionBag): AsyncQueueItem<U>;
        then<U>(onfulfilled?: (value: T) => U | PromiseLike<U>, onrejected?: (error: any) => U | PromiseLike<U>, options?: AsyncQueueOptionBag): AsyncQueueItem<U>;
        catch<U>(onrejected?: (error: any) => U | PromiseLike<U>, options?: CancellableOptionBag): AsyncQueueItem<U>;
    }
    class CancellableFeed<T> extends Cancellable<T> {
        cancel(): Promise<void>;
    }
}

export = Cancellables;