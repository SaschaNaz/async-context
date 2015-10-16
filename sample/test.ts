declare var singleRun: HTMLInputElement;
declare var singleCancel: HTMLInputElement;
declare var contRun: HTMLInputElement;
declare var contCancel: HTMLInputElement;
declare var awaitRun: HTMLInputElement;
declare var awaitCancel: HTMLInputElement;

import AsyncContext = AsyncChainer.AsyncContext;
import AsyncFeed = AsyncChainer.AsyncFeed;
import Contract = AsyncChainer.Contract;

function delayedLogger() {
    return new AsyncContext<void>((context) => {
        setTimeout(() => {
            context.resolve();
        }, 10000);
    }).feed();
}

function continuousLogger() {
    let count = 0;
    let timer: number;
    
    return new AsyncContext<number>((context) => {
        let feed = context.queue<void>();
        let connect = () => {
            feed = feed.then(() => waitFor(1000)).then(() => count++).then(() => {
                if (!context.canceled) {
                    connect() 
                }
                else {
                    context.resolve(count);
                }
            }, { behaviorOnCancellation: "none" });
        }
        connect();
    }, { deferCancellation: true }).feed();
}

function awaitWaiter() {
    return new AsyncContext<boolean>(async (context) => {
        let result = await context.queue(() => waitFor(5000)).then((value) => {
            return value === AsyncChainer.Cancellation ? "cancel" : "uncancel";
        }, { behaviorOnCancellation: "none" });
        
        if (result !== "cancel") {
            context.resolve(false);
        }
        else {
            context.resolve(true)
        }
    }, { deferCancellation: true }).feed();
}

function waitFor(millisecond: number) {
    return new AsyncFeed((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, millisecond)
    })
} 

function waitEvent<T extends Event>(element: EventTarget, eventName: string) {
    let callback: (evt: T) => void;
    return new AsyncFeed<void>((resolve, reject) => {
        callback = () => resolve();
        element.addEventListener(eventName, callback);
    }, { 
        revert: () => element.removeEventListener(eventName, callback)
    });
}

function subscribeEvent<T extends Event>(element: EventTarget, eventName: string, listener: () => any) {
    let callback = (evt: T) => listener.call(element, evt, feed);
    var feed = new AsyncFeed<void>((resolve, reject) => {
        element.addEventListener(eventName, callback);
    }, {
        revert: () => element.removeEventListener(eventName, callback)
    });
    return feed;
}

waitEvent(document, "DOMContentLoaded").then(() => {
    alert("DOMContentLOADED!");
    
    let logger: AsyncFeed<void>;
    subscribeEvent(singleRun, "click", () => {
        logger = delayedLogger();
        logger.then((value) => alert(value));
    })
    subscribeEvent(singleCancel, "click", () => {
        logger.cancel();
    })
    
    let contLogger: AsyncFeed<number>
    subscribeEvent(contRun, "click", () => {
        contLogger = continuousLogger();
        contLogger.then((count) => alert(count));
    })
    subscribeEvent(contCancel, "click", () => {
        contLogger.cancel();
    })
    
    let awaiter: AsyncFeed<boolean>
    subscribeEvent(awaitRun, "click", () => {
        awaiter = awaitWaiter();
        awaiter.then((count) => alert(count));
    })
    subscribeEvent(awaitCancel, "click", () => {
        awaiter.cancel();
    })
});