import assert from 'assert';
import { Handler } from '../lib/handler';
import { taskDefinition } from './fixtures/task';
import { statusMessage } from './fixtures/task_status';
import { jobMessage } from './fixtures/job_message';
import parseRoute from '../lib/util/route_parser';
import Monitor from 'taskcluster-lib-monitor';
import taskcluster from 'taskcluster-client';

let handler, task, status, expected, pushInfo;

suite('handle exception job', () => {
  beforeEach(async () => {
    handler = new Handler({
      prefix: 'treeherder',
      queue: new taskcluster.Queue(),
      monitor: await Monitor({
        project: 'tc-treeherder-test',
        credentials: {},
        mock: true,
      }),
    });
    task = JSON.parse(taskDefinition);
    status = JSON.parse(statusMessage);
    expected = JSON.parse(jobMessage);
    pushInfo = parseRoute(task.routes[0]);
  });

  test('valid message', async () => {
    let actual;
    handler.publishJobMessage = (pushInfo, job) => {
      actual = job;
    };

    let scheduled = new Date();
    let started = new Date();
    let resolved = new Date();
    started.setMinutes(started.getMinutes() + 5)
    resolved.setMinutes(resolved.getMinutes() + 10)

    status.status.runs[0] = {
      runId: 0,
      state: 'exception',
      reasonCreated: 'scheduled',
      scheduled: scheduled.toISOString(),
      started: started.toISOString(),
      resolved: resolved.toISOString()
    };

    expected.state = 'completed';
    expected.result = 'exception';
    expected.timeStarted = started.toISOString();
    expected.timeCompleted = resolved.toISOString();
    expected.logs = [
      {
        name: "builds-4h",
        url: "https://queue.taskcluster.net/v1/task/5UMTRzgESFG3Bn8kCBwxxQ/runs/0/artifacts/public/logs/live_backing.log"
      }
    ];

    let job = await handler.handleTaskException(pushInfo, task, status);
    assert.deepEqual(actual, expected);
  });

  test('superseded message', async () => {
    let actual;
    handler.publishJobMessage = (pushInfo, job) => {
      actual = job;
    };

    let scheduled = new Date();
    let started = new Date();
    let resolved = new Date();
    started.setMinutes(started.getMinutes() + 5)
    resolved.setMinutes(resolved.getMinutes() + 10)

    status.status.runs[0] = {
      runId: 0,
      state: 'exception',
      reasonCreated: 'scheduled',
      reasonResolved: 'superseded',
      scheduled: scheduled.toISOString(),
      started: started.toISOString(),
      resolved: resolved.toISOString()
    };

    expected.state = 'completed';
    expected.result = 'coalesced';
    expected.timeStarted = started.toISOString();
    expected.timeCompleted = resolved.toISOString();
    expected.logs = [
      {
        name: "builds-4h",
        url: "https://queue.taskcluster.net/v1/task/5UMTRzgESFG3Bn8kCBwxxQ/runs/0/artifacts/public/logs/live_backing.log"
      }
    ];

    let job = await handler.handleTaskException(pushInfo, task, status);
    assert.deepEqual(actual, expected);
  });

  test('do not publish when reason created is exception', async () => {
    let actual;
    handler.publishJobMessage = (pushInfo, job) => {
      actual = job;
    };

    let scheduled = new Date();
    let started = new Date();
    let resolved = new Date();
    started.setMinutes(started.getMinutes() + 5)
    resolved.setMinutes(resolved.getMinutes() + 10)

    status.status.runs[0] = {
      runId: 0,
      state: 'exception',
      reasonCreated: 'exception',
      scheduled: scheduled.toISOString(),
      started: started.toISOString(),
      resolved: resolved.toISOString()
    };

    expected.logs = [
      {
        name: "builds-4h",
        url: "https://queue.taskcluster.net/v1/task/5UMTRzgESFG3Bn8kCBwxxQ/runs/0/artifacts/public/logs/live_backing.log"
      }
    ];

    let job = await handler.handleTaskException(pushInfo, task, status);
    assert.deepEqual(actual, undefined);
  });
});
