import chalk from 'chalk'
import * as ZB from '../lib/interfaces-1.0'
import { JobBatcher } from '../lib/JobBatcher'
import {
	ZBBatchWorkerConstructorConfig,
	ZBWorkerBase,
} from '../lib/ZBWorkerBase'

export class ZBBatchWorker<
	InputVariables = ZB.IInputVariables,
	Headers = ZB.ICustomHeaders,
	OutputVariables = ZB.IOutputVariables
> extends ZBWorkerBase<InputVariables, Headers, OutputVariables> {
	private jobBatchMaxTime: number
	private jobBuffer: { batch: (job: any) => void }
	constructor(
		config: ZBBatchWorkerConstructorConfig<
			InputVariables,
			Headers,
			OutputVariables
		>
	) {
		super(config)
		this.jobBatchMaxTime = config.options.jobBatchMaxTime
		if (this.timeout < this.jobBatchMaxTime) {
			const jobBatchMaxTimeout = this.jobBatchMaxTime
			this.log(`\n`)
			this.log(chalk.redBright(`=================================`))
			this.log(
				`${chalk.yellowBright('WARNING:')} The ${
					this.taskType
				} batch worker is ${chalk.yellowBright('MISCONFIGURED')}.`
			)
			this.log(
				`Its settings can ${chalk.yellowBright(
					'RESULT IN ITS JOBS TIMING OUT'
				)}.`
			)
			this.log(
				`The ${chalk.greenBright(
					'jobBatchMaxTimeout'
				)}: ${jobBatchMaxTimeout} is longer than the ${chalk.greenBright(
					'timeout'
				)}: ${this.timeout}.`
			)
			this.log(
				`This can lead to jobs timing out and retried by the broker before this worker executes their batch.`
			)
			this.log(
				chalk.redBright(
					'This is probably not the behaviour you want. Read the docs, and reconsider your life choices.'
				)
			)
			this.log(
				chalk.yellowBright(
					`Recommended: Reconfigure the ZBBatchWorker to have a higher timeout than its jobBatchMaxTimeout setting.`
				)
			)
			this.log(chalk.redBright(`=================================`))
			this.log(`\n`)
		}
		this.jobBuffer = new JobBatcher({
			batchSize: this.jobBatchMinSize,
			handler: this.taskHandler as ZB.ZBBatchWorkerTaskHandler<
				any,
				any,
				any
			>,
			timeout: this.jobBatchMaxTime,
			worker: this,
		})
	}

	protected async handleJobs(jobs: ZB.Job<InputVariables, Headers>[]) {
		const batchedJobs = jobs.map(
			(job): ZB.BatchedJob<InputVariables, Headers, OutputVariables> => ({
				...job,
				...this.makeCompleteHandlers(job),
			})
		)
		this.jobBuffer.batch(batchedJobs)
	}
}
