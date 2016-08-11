/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;
import CancellableFeed = Cancellables.CancellableFeed;

function waitFor(millisecond: number) {
    return new CancellableFeed((resolve, reject) => {
        setTimeout(() => resolve(), millisecond)
    })
}

function continuousLogger() {
    let count = 0;
    let timer: number;

    return new CancellableContext<number>((context) => {
        let feed = context.queue<void>();
        let connect = () => {
            feed = feed.queue(() => count++).queue(() => waitFor(0)).queue(() => {
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

describe("Continuous logger", function() {
    it("should count", function(done) {
        let logger = continuousLogger();
        logger
            .then(count => {
                chai.assert(count > 3, "Count should be greater than 3");
            })
            .then(done, done);
        waitFor(300).then(() => logger.cancel());
    })
});