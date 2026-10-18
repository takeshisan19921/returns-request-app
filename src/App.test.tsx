import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { createLocalApi, createMemoryStorage, STORAGE_KEY } from './lib/api';

const setup = (initial: Record<string, string> = {}) => {
  const storage = createMemoryStorage(initial);
  const api = createLocalApi({ storage, delayMs: 0, now: () => new Date('2026-10-18T09:30:00Z') });
  const user = userEvent.setup();
  render(<App api={api} today="2026-10-18" />);
  return { user, storage };
};

const findOrder = async (user: ReturnType<typeof userEvent.setup>, orderNumber: string, email: string) => {
  await user.type(screen.getByLabelText('Order number'), orderNumber);
  if (email) await user.type(screen.getByLabelText('Email address'), email);
  await user.click(screen.getByRole('button', { name: 'Find order' }));
};

describe('Returns app', () => {
  it('lists every lookup error, moves focus to the summary and marks fields invalid', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Find order' }));

    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(within(summary).getAllByRole('link')).toHaveLength(2);
    expect(screen.getByLabelText('Order number')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Order number')).toHaveAccessibleDescription(
      'For example ORD-10421 Enter your order number, for example ORD-10421.',
    );
  });

  it('shows one message for a wrong email and a separate one when the service is down', async () => {
    const { user } = setup();
    await findOrder(user, 'ORD-10421', 'wrong@example.com');
    expect(await screen.findByText("We couldn't find an order with that number and email address.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Order number'));
    await findOrder(user, 'ORD-99999', '');
    expect(await screen.findByText("The returns service didn't respond. Try again in a moment.")).toBeInTheDocument();
  });

  it('runs a return from lookup to cancellation', async () => {
    const { user, storage } = setup();
    expect(await screen.findByText('No return requests yet. Find an order to start one.')).toBeInTheDocument();
    await findOrder(user, 'ord-10421', 'sanne@example.com');

    expect(await screen.findByRole('heading', { name: 'Return items from ORD-10421' })).toHaveFocus();
    expect(screen.getByRole('checkbox', { name: /Canvas tote/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Canvas tote/ })).toHaveAccessibleDescription('Final sale, not returnable');

    await user.click(screen.getByRole('checkbox', { name: /Linen shirt/ }));
    await user.click(screen.getByRole('button', { name: 'Request return' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a reason for returning Linen shirt.');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Reason for Linen shirt' }), 'damaged');
    await user.type(screen.getByRole('textbox', { name: 'What went wrong with Linen shirt?' }), 'Seam torn at the collar');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Quantity of Linen shirt' }), '2');
    expect(screen.getByText('Return shipping').nextElementSibling).toHaveTextContent('Free');
    await user.click(screen.getByRole('button', { name: 'Request return' }));

    expect(await screen.findByRole('heading', { name: 'Return requested' })).toHaveFocus();
    expect(screen.getByText('RET-1001', { selector: 'strong' })).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Your return requests' });
    expect(await within(list).findByText('2 × Linen shirt')).toBeInTheDocument();
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toHaveLength(1);

    await user.click(within(list).getByRole('button', { name: 'Cancel return RET-1001' }));
    expect(await within(list).findByText('Cancelled')).toBeInTheDocument();
    expect(within(list).getByRole('status')).toHaveTextContent('Return RET-1001 cancelled.');
  });

  it('blocks a second return for units already in an open return', async () => {
    const { user } = setup();
    await findOrder(user, 'ORD-10421', 'sanne@example.com');
    await user.click(await screen.findByRole('checkbox', { name: /Linen shirt/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Quantity of Linen shirt' }), '2');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Reason for Linen shirt' }), 'too-small');
    await user.click(screen.getByRole('button', { name: 'Request return' }));
    await user.click(await screen.findByRole('button', { name: 'Start another return' }));

    await findOrder(user, 'ORD-10421', 'sanne@example.com');
    const shirt = await screen.findByRole('checkbox', { name: /Linen shirt/ });
    expect(shirt).toBeDisabled();
    expect(shirt).toHaveAccessibleDescription('Already in an open return');
  });

  it('shows a retry option instead of an empty list when saved data is unreadable', async () => {
    setup({ [STORAGE_KEY]: '{broken' });
    expect(await screen.findByText('Saved return requests could not be read.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText(/No return requests yet/)).not.toBeInTheDocument();
  });
});
