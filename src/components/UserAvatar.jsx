import { userInitials } from '@/lib/transactions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function UserAvatar({ user, className, size = 'default' }) {
  return (
    <Avatar className={cn(className)} size={size}>
      {user?.avatarUrl ? (
        <AvatarImage src={user.avatarUrl} alt="" />
      ) : null}
      <AvatarFallback className="font-semibold">
        {userInitials(user)}
      </AvatarFallback>
    </Avatar>
  );
}
