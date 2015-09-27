declare var singleRun: HTMLInputElement;
declare var singleCancel: HTMLInputElement;
declare var contRun: HTMLInputElement;
declare var contCancel: HTMLInputElement;

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
			feed = feed.then(() => waitFor(1000)).then(() => count++).then(() => connect());
		}
		connect();
	}).feed();
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
});