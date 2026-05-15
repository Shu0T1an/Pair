import { describe, it, expect } from 'vitest';
import { AgentManager } from '../agent-manager';

describe('AgentManager', () => {
  it('should create a new session', async () => {
    const manager = new AgentManager();
    const session = await manager.createSession({
      projectPath: '/test/project',
    });
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.projectPath).toBe('/test/project');
  });

  it('should list sessions by project', async () => {
    const manager = new AgentManager();
    
    await manager.createSession({ projectPath: '/project1' });
    await manager.createSession({ projectPath: '/project1' });
    await manager.createSession({ projectPath: '/project2' });
    
    const sessions = await manager.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessions).toHaveLength(2);
    expect(sessions[1].sessions).toHaveLength(1);
  });

  it('should delete a session', async () => {
    const manager = new AgentManager();
    const session = await manager.createSession({ projectPath: '/test' });
    
    await manager.deleteSession(session.id);
    
    const sessions = await manager.listSessions();
    expect(sessions).toHaveLength(0);
  });

  it('should throw when deleting non-existent session', async () => {
    const manager = new AgentManager();
    
    await expect(manager.deleteSession('non-existent')).rejects.toThrow();
  });
});