import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Navigation from '../Navigation.vue';

vi.mock('@/router', () => ({
    prefetchRouteBySlug: vi.fn(() => Promise.resolve()),
}));

describe('Navigation snapshots', () => {
    const mountComponent = (props?: Partial<InstanceType<typeof Navigation>['$props']>) =>
        mount(Navigation, {
            props: {
                activeTab: 'today',
                ...props,
            },
        });

    it('matches snapshot for top navigation layout', () => {
        const wrapper = mountComponent();
        expect(wrapper.html()).toMatchSnapshot();
    });

    it('matches snapshot for bottom navigation layout with active exercises tab', () => {
        const wrapper = mountComponent({ activeTab: 'exercises', variant: 'bottom' });
        expect(wrapper.html()).toMatchSnapshot();
    });
});
