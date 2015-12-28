/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;
import CancellableFeed = Cancellables.CancellableFeed;

let delayedLogger = function delayedLogger() {
    return new CancellableContext<void>((context) => {
        setTimeout(() => {
            context.resolve();
        }, 10000);
    }).feed();
}

describe("Waiting 10 seconds, with ES5", function() {
    it("should call done", function(done) {
        let now = Date.now();
        let logger = delayedLogger();
        logger.then((value) => {
            chai.assert((Date.now() - now) > 9000); // at least 9 seconds
            done();
        });
    });
    // No Proxy support on Node.js v4.2 which is required for async-chainer
    // Delay making mocha tests until they implement it
})
// subscribeEvent(singleRun, "click", () => {
// 	logger = delayedLogger();
// 	logger.then((value) => alert(value));
// })
// subscribeEvent(singleCancel, "click", () => {
// 	logger.cancel();
// })

// TODO: 1 wait 2 cancel on mocha