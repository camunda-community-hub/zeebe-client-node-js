export class Queue<T> {
	private q: T[] = []
	public push = (element: T) => this.q.push(element)

	public pop = (): T | undefined => this.q.shift()

	public isEmpty = (): boolean => this.q.length > 0

	public drain = () => this.q.splice(0, this.q.length)

	public length = (): number => this.q.length
}
