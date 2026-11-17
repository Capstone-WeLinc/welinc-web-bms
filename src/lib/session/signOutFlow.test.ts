import {beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('../../components/shared/confirm/confirm',()=>({confirm:vi.fn()}));
vi.mock('./session',()=>({signOut:vi.fn()}));
import {confirm} from '../../components/shared/confirm/confirm';
import {signOut} from './session';
import {signOutFlow} from './signOutFlow';
describe('BMS reference sign out flow',()=>{
 beforeEach(()=>vi.resetAllMocks());
 it('cancels without logging out',async()=>{vi.mocked(confirm).mockResolvedValue(false);await signOutFlow({ask:true});expect(signOut).not.toHaveBeenCalled();});
 it('signs out after confirmation',async()=>{vi.mocked(confirm).mockResolvedValue(true);vi.mocked(signOut).mockResolvedValue('ok');await signOutFlow({ask:true});expect(signOut).toHaveBeenCalledTimes(1);});
 it('offers retry when the service cannot be reached',async()=>{vi.mocked(signOut).mockResolvedValueOnce('failed').mockResolvedValueOnce('ok');vi.mocked(confirm).mockResolvedValue(true);await signOutFlow({ask:false});expect(confirm).toHaveBeenCalledWith(expect.objectContaining({title:"Couldn't sign out"}));expect(signOut).toHaveBeenCalledTimes(2);});
 it('stays on the page when retry is declined',async()=>{vi.mocked(signOut).mockResolvedValue('failed');vi.mocked(confirm).mockResolvedValue(false);await signOutFlow({ask:false});expect(signOut).toHaveBeenCalledTimes(1);});
});
