import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-if-else-state-cascade.js";

ruleTester.run("no-if-else-state-cascade", rule, {
  valid: [
    `function handle(form: Form) {
      if (form.status === "empty") return "empty";
      else if (form.status === "validating") return "validating";
    }`,
    `function check(x: X) {
      if (x.kind === "a") return 1;
      else if (x.kind === "b") return 2;
      else if (x.other === "c") return 3;
    }`,
    `function switchOk(form: Form) {
      switch (form.status) {
        case "empty": return "empty";
        case "validating": return "validating";
        case "invalid": return "invalid";
        default: return "unknown";
      }
    }`,
    `function notStringLiteral(val: { type: number }) {
      if (val.type === 1) return "one";
      else if (val.type === 2) return "two";
      else if (val.type === 3) return "three";
    }`,
    `function notMember(val: string) {
      if (val === "a") return 1;
      else if (val === "b") return 2;
      else if (val === "c") return 3;
    }`,
    `function mixedPreventsDetection(x: X) {
      if (x.status !== "a") return 1;
      else if (x.status === "b") return 2;
      else if (x.status > 0) return 3;
    }`,
    {
      code: `function handle(form: Form) {
        if (form.status === "empty") return "empty";
        else if (form.status === "validating") return "validating";
        else if (form.status === "invalid") return "invalid";
      }`,
      options: [{ minBranches: 4 }],
    },
  ],
  invalid: [
    {
      code: `function handleSubmit(form: Form) {
        if (form.status === "empty") return { error: "Required fields missing" };
        else if (form.status === "validating") return { error: "Still validating..." };
        else if (form.status === "invalid") return { error: form.errors.join(", ") };
        else if (form.status === "submitting") return { error: "Already submitting..." };
      }`,
      errors: [{ messageId: "stateCascade" }],
    },
    {
      code: `function process(item: Item) {
        if (item.type === "user") return handleUser(item);
        else if (item.type === "admin") return handleAdmin(item);
        else if (item.type === "guest") return handleGuest(item);
      }`,
      errors: [{ messageId: "stateCascade" }],
    },
    {
      code: `function route(req: Request) {
        if (req.method === "GET") return getHandler(req);
        else if (req.method === "POST") return postHandler(req);
        else if (req.method === "PUT") return putHandler(req);
        else if (req.method === "DELETE") return deleteHandler(req);
      }`,
      errors: [{ messageId: "stateCascade" }],
    },
    {
      code: `function handle(obj: Obj) {
        if (obj.data.state === "init") return init();
        else if (obj.data.state === "loading") return loading();
        else if (obj.data.state === "done") return done();
      }`,
      errors: [{ messageId: "stateCascade" }],
    },
    {
      code: `function check(form: Form) {
        if ("pending" === form.status) return "p";
        else if ("done" === form.status) return "d";
        else if ("fail" === form.status) return "f";
      }`,
      errors: [{ messageId: "stateCascade" }],
    },
    {
      code: `function check(x: X) {
        if (x.status !== "a") return 1;
        else if (x.status !== "b") return 2;
        else if (x.status !== "c") return 3;
      }`,
      errors: [{ messageId: "stateCascade" }],
    },
    {
      code: `function handle(form: Form) {
        if (form.status === "pending") return "p";
        else if (form.status === "done") return "d";
      }`,
      options: [{ minBranches: 2 }],
      errors: [{ messageId: "stateCascade" }],
    },
  ],
});
