/// <reference path="../declarations/mocha.d.ts" />
/// <reference path="../declarations/chai.d.ts" />
"use strict"
import * as chai from "chai"

import * as Cancellables from "../built/cancellables-modular";
import Cancellable = Cancellables.Cancellable;

function errorWaiter() {
    return new Cancellable<void>((resolve, reject) => {
        throw new Error("wow6");
    });
};

describe("Error processing on single cancellable construction", function() {
    it("should call catch", function(done) {
        let now = Date.now();
        let logger = errorWaiter();
        logger.catch(err => {
            chai.assert(err.message === "wow6", "Message should be 'wow6'")
            done()
        });
    });
});