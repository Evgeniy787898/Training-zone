import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ErrorState from '../ErrorState.vue';

vi.mock('@/utils/hapticFeedback', () => ({
    hapticSelection: vi.fn(),
}));

describe('ErrorState snapshots', () => {
    it('renders default message and action', () => {
        const wrapper = mount(ErrorState);
        expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders custom content', () => {
        const wrapper = mount(ErrorState, {
            props: {
                message: 'Что-то пошло не так при загрузке достижений',
                actionLabel: 'Обновить данные',
            },
        });
        expect(wrapper.html()).toMatchSnapshot();
    });
});
