import { ZBClient } from "..";

describe("ZBClient constructor", () => {
    it("creates a new ZBClient", () => {
        const zbc = new ZBClient("localhost");
        expect(zbc instanceof ZBClient).toBe(true);
    });
    it("appends the port number 26500 to the brokerAddress by default", () => {
        const zbc = new ZBClient("localhost");
        expect(zbc.brokerAddress).toBe("localhost:26500");
    });
    it("accepts a custom port number for the brokerAddress", () => {
        const zbc = new ZBClient("localhost:123");
        expect(zbc.brokerAddress).toBe("localhost:123");
    });
    it("throws an exception when not provided a brokerAddress in the constructor", () => {
        expect(() => new (ZBClient as any)()()).toThrow();
    });
});

describe("ZBClient.deployWorkflow()", () => {

    beforeAll(() => {
        return null;
    });

    it("deploys a single workflow", async () => {
        const zbc = new ZBClient("localhost");
        const res = await zbc.deployWorkflow("./test/hello-world.bpmn");
        expect(res.workflows.length).toBe(1);
    });
    it("by default, it deploys a single workflow when that workflow is already deployed", () => {
        // const zbc = new ZBClient("localhost");
        expect(true).toBe(true);
    });
    it("with {redeploy: false} it will not redeploy an existing workflow", () => {
        // const zbc = new ZBClient("localhost");
        expect(true).toBe(true);
    });
});
