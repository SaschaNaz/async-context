/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;

function errorWaiter() {
    return new CancellableContext<void>(async (context) => {
        await context.queue().queue(() => {
            throw new Error("wow8")
        });
    }).feed()
};

describe("Error processing on failed queue item 3", function() {
    it("should call catch", function(done) {
        let now = Date.now();
        let logger = errorWaiter();
        logger.catch(err => {
            chai.assert(err.message === "wow8", "Message should be 'wow8'")
            done()
        });
    });
});