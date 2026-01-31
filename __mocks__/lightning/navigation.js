/**
 * Mock for lightning/navigation
 */
export const NavigationMixin = (Base) => {
    return class extends Base {
        [NavigationMixin.Navigate](pageRef) {
            this._pageRef = pageRef;
        }
        [NavigationMixin.GenerateUrl](pageRef) {
            return Promise.resolve('https://mock-url.com');
        }
    };
};

NavigationMixin.Navigate = Symbol('Navigate');
NavigationMixin.GenerateUrl = Symbol('GenerateUrl');
