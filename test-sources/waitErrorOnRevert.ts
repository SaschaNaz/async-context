/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import CancellableContext = Cancellables.CancellableContext;
import Cancellable = Cancellables.Cancellable;

function errorWaiter() {
    return new CancellableContext<void>(async (context) => {
        try {
            await new Cancellable((resolve) => resolve(), {
                revert: () => { throw new Error("wow") }
            });
            context.resolve();
        }
        catch (e) {
            context.reject(e);
        }
    }).feed()
}

describe("Error processing on revert when immediately resolved", function() {
    it("should call catch", function(done) {
        let now = Date.now();
        let logger = errorWaiter();
        logger.catch(err => {
            chai.assert(err.message === "wow", "Message should be 'wow'")
            done()
        });
    });
});