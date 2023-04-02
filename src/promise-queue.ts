export class PromiseQueue {
  private _curr: Promise<any> = Promise.resolve();

  // Probably can remove `async` from this method.
  public async add<T>(task: () => Promise<T>): Promise<T> {
    const result = this._curr.then(task);
    this._curr = result.catch(() => { });
    return result;
  }
}
