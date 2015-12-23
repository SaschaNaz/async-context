declare var singleRun: HTMLInputElement;
declare var singleCancel: HTMLInputElement;
declare var contRun: HTMLInputElement;
declare var contCancel: HTMLInputElement;
declare var awaitRun: HTMLInputElement;
declare var awaitCancel: HTMLInputElement;
declare var await2Run: HTMLInputElement;
declare var await2Cancel: HTMLInputElement;
declare var await3Run: HTMLInputElement;
declare var await3Cancel: HTMLInputElement;
declare var errorRun: HTMLInputElement;
declare var error2Run: HTMLInputElement;
declare var error2Cancel: HTMLInputElement;
declare var error3Run: HTMLInputElement;
declare var error3Cancel: HTMLInputElement;
declare var error4Run: HTMLInputElement;
declare var error5Run: HTMLInputElement;
declare var error6Run: HTMLInputElement;
declare var error7Run: HTMLInputElement;
declare var error8Run: HTMLInputElement;

import AsyncContext = Cancellables.AsyncContext;
import AsyncFeed = Cancellables.AsyncFeed;
import Contract = Cancellables.Cancellable;

function waitFor(millisecond: number) {
    return new AsyncFeed((resolve, reject) => {
        setTimeout(() => resolve(), millisecond)
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
    {
        let logger: AsyncFeed<void>;
        let delayedLogger = function delayedLogger() {
            return new AsyncContext<void>((context) => {
                setTimeout(() => {
                    context.resolve();
                }, 10000);
            }).feed();
        }
        subscribeEvent(singleRun, "click", () => {
            logger = delayedLogger();
            logger.then((value) => alert(value));
        })
        subscribeEvent(singleCancel, "click", () => {
            logger.cancel();
        })
    }
    
    {
        let contLogger: AsyncFeed<number>
        let continuousLogger = function continuousLogger() {
            let count = 0;
            let timer: number;
            
            return new AsyncContext<number>((context) => {
                let feed = context.queue<void>();
                let connect = () => {
                    feed = feed.queue(() => waitFor(1000)).queue(() => count++).queue(() => {
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
        subscribeEvent(contRun, "click", () => {
            contLogger = continuousLogger();
            contLogger.then((count) => alert(count));
        })
        subscribeEvent(contCancel, "click", () => {
            contLogger.cancel();
        })
    }
    
    {
        let awaiter: AsyncFeed<boolean>
        let awaitWaiter = function awaitWaiter() {
            return new AsyncContext<boolean>(async (context) => {
                let result = await context.queue(() => waitFor(3000)).queue((value) => {
                    return value === Cancellables.cancellation ? "cancel" : "uncancel";
                }, { behaviorOnCancellation: "none" });
                
                if (result !== "cancel") {
                    context.resolve(false);
                }
                else {
                    context.resolve(true)
                }
            }, { deferCancellation: true }).feed();
        }
        subscribeEvent(awaitRun, "click", () => {
            awaiter = awaitWaiter();
            awaiter.then((count) => alert(count));
        })
        subscribeEvent(awaitCancel, "click", () => {
            awaiter.cancel();
        })
    }
    
    {
        let awaiter2: AsyncFeed<boolean>
        let awaitWaiter2 = function awaitWaiter2() {
            return new AsyncContext<boolean>(async (context) => {
                let result = await context.queue(() => waitFor(3000));
                
                if (result !== Cancellables.cancellation) {
                    context.resolve(false);
                }
                else {
                    context.resolve(true)
                }
            }, { deferCancellation: true }).feed();
        }
        subscribeEvent(await2Run, "click", () => {
            awaiter2 = awaitWaiter2();
            awaiter2.then((count) => alert(count));
        })
        subscribeEvent(await2Cancel, "click", () => {
            awaiter2.cancel();
        })
    }
    
    {
        let awaiter3: AsyncFeed<boolean>
        let awaitWaiter3 = function awaitWaiter3() {
            return new AsyncContext<boolean>(async (context) => {
                await waitFor(3000);
                
                let result = await context.queue(() => Promise.resolve());  
                
                if (result !== Cancellables.cancellation) {
                    context.resolve(false);
                }
                else {
                    context.resolve(true)
                }
            }, { deferCancellation: true }).feed();
        }
        subscribeEvent(await3Run, "click", () => {
            awaiter3 = awaitWaiter3();
            awaiter3.then((count) => alert(count));
        })
        subscribeEvent(await3Cancel, "click", () => {
            awaiter3.cancel();
        })
    }
    
    {
        let eWaiter: AsyncFeed<void>
        let errorWaiter = function errorWaiter() {
            return new AsyncContext<void>(async (context) => {
                try {
                    await new Contract((resolve) => resolve(), {
                        revert: () => { throw new Error("wow") }
                    });
                    context.resolve();
                }   
                catch (e) {
                    context.reject(e);
                }
            }).feed()
        }
        subscribeEvent(errorRun, "click", () => {
            eWaiter = errorWaiter();
            eWaiter.catch((error) => alert(error));
        })
    }
    
    {
        let waiter: AsyncFeed<void>
        let errorWaiter2 = function errorWaiter2() {
            return new AsyncContext<void>((context) => { }, {
                revert: () => {
                    throw new Error("wow2")
                }
            }).feed()
        }
        subscribeEvent(error2Run, "click", () => {
            waiter = errorWaiter2();
            waiter.catch((error) => alert(error));
        })
        subscribeEvent(error2Cancel, "click", () => {
            waiter.cancel();
        })
    }
    
    {
        let waiter: AsyncFeed<void>
        let errorWaiter3 = function errorWaiter3() {
            return new AsyncContext<void>((context) => { }, {
                precancel: () => {
                    throw new Error("wow3")
                }
            }).feed()
        }
        subscribeEvent(error3Run, "click", () => {
            waiter = errorWaiter3();
        })
        subscribeEvent(error3Cancel, "click", () => {
            waiter.cancel().catch((error) => alert(error));
        })
    }
    
    {
        let errorWaiter = function errorWaiter() {
            return new AsyncContext<void>((context) => {
                throw new Error("wow4");
            }).feed()
        };
        subscribeEvent(error4Run, "click", () => {
            errorWaiter().catch((error) => alert(error));
        });
    }
    
    {
        let errorWaiter = function errorWaiter() {
            return new AsyncContext<void>(async (context) => {
                await context.queue(() => Promise.reject(new Error("wow5")));
            }).feed()
        };
        subscribeEvent(error5Run, "click", () => {
            errorWaiter().catch((error) => alert(error));
        });
    }
    
    
    {
        let errorWaiter = function errorWaiter() {
            return new Contract<void>((context) => {
                throw new Error("wow6");
            });
        };
        subscribeEvent(error6Run, "click", () => {
            errorWaiter().catch((error) => alert(error));
        });
    }

    {
        let errorWaiter = function errorWaiter() {
            return new AsyncContext<void>(async (context) => {
                await context.queue(() => {
                    throw new Error("wow7")
                });
            }).feed()
        };
        subscribeEvent(error7Run, "click", () => {
            errorWaiter().catch((error) => alert(error));
        });
    }
    
    {
        let errorWaiter = function errorWaiter() {
            return new AsyncContext<void>(async (context) => {
                await context.queue().queue(() => {
                    throw new Error("wow8")
                });
            }).feed()
        };
        subscribeEvent(error8Run, "click", () => {
            errorWaiter().catch((error) => alert(error));
        });
    }
});