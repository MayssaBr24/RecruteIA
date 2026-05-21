export const getDaysLeft = (deadline: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(deadline);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / 864e5);
};

export const isJobActive = (job: { offer_deadline?: string }): boolean => {
    return !job.offer_deadline || getDaysLeft(job.offer_deadline) >= 0;
};

export const isNewThisWeek = (date: string): boolean => {
    return new Date(date) > new Date(Date.now() - 7 * 864e5);
};