import { describe, it, expect, vi } from "vitest";
import {
  DeleteAccountError,
  runAccountDeletion,
  type DeleteAccountDeps,
  type DeleteAccountStep,
} from "@/lib/delete-account";

function makeDeps(overrides: Partial<DeleteAccountDeps> = {}) {
  const calls: string[] = [];
  const deps: DeleteAccountDeps = {
    isOnline: () => true,
    stopSync: () => {
      calls.push("stopSync");
    },
    deleteChat: async () => {
      calls.push("deleteChat");
    },
    deleteServer: async () => {
      calls.push("deleteServer");
    },
    signOutLocal: async () => {
      calls.push("signOutLocal");
    },
    wipeLocal: async () => {
      calls.push("wipeLocal");
    },
    ...overrides,
  };
  return { deps, calls };
}

describe("runAccountDeletion — thứ tự và chặn lỗi", () => {
  it("dừng sync, xoá chat, xoá server, đăng xuất rồi mới dọn máy", async () => {
    const { deps, calls } = makeDeps();
    await runAccountDeletion(deps);
    expect(calls).toEqual([
      "stopSync",
      "deleteChat",
      "deleteServer",
      "signOutLocal",
      "wipeLocal",
    ]);
  });

  it("báo tiến trình theo từng bước", async () => {
    const { deps } = makeDeps();
    const steps: DeleteAccountStep[] = [];
    await runAccountDeletion(deps, (step) => steps.push(step));
    expect(steps).toEqual(["chat", "server", "local"]);
  });

  it("offline thì dừng trước khi làm bất cứ điều gì", async () => {
    const { deps, calls } = makeDeps({ isOnline: () => false });
    await expect(runAccountDeletion(deps)).rejects.toMatchObject({ code: "OFFLINE" });
    expect(calls).toEqual([]);
  });

  it("lỗi khi xoá chat thì không gọi máy chủ và không dọn máy", async () => {
    const deleteServer = vi.fn(async () => {});
    const signOutLocal = vi.fn(async () => {});
    const wipeLocal = vi.fn(async () => {});
    const { deps } = makeDeps({
      deleteChat: async () => {
        throw new DeleteAccountError("CHAT_FAILED", "lỗi chat");
      },
      deleteServer,
      signOutLocal,
      wipeLocal,
    });

    await expect(runAccountDeletion(deps)).rejects.toMatchObject({
      code: "CHAT_FAILED",
    });
    expect(deleteServer).not.toHaveBeenCalled();
    expect(signOutLocal).not.toHaveBeenCalled();
    expect(wipeLocal).not.toHaveBeenCalled();
  });

  it("lỗi khi xoá tài khoản trên máy chủ thì không dọn máy để còn thử lại", async () => {
    const signOutLocal = vi.fn(async () => {});
    const wipeLocal = vi.fn(async () => {});
    const { deps } = makeDeps({
      deleteServer: async () => {
        throw new DeleteAccountError("SERVER_FAILED", "lỗi máy chủ");
      },
      signOutLocal,
      wipeLocal,
    });

    await expect(runAccountDeletion(deps)).rejects.toMatchObject({
      code: "SERVER_FAILED",
    });
    expect(signOutLocal).not.toHaveBeenCalled();
    expect(wipeLocal).not.toHaveBeenCalled();
  });
});
