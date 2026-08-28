INSERT INTO daily_performance (
  date, recommendations, settled, unresolved, settled_stake_cents,
  gross_return_cents, profit_loss_cents, roi, wins, losses, voids,
  fully_settled, data_as_of
) VALUES
  ('2026-05-18', 4, 0, 4, 0, 0, 0, NULL, 0, 0, 0, 0, '2026-05-18T23:59:59Z'),
  ('2026-05-22', 4, 0, 4, 0, 0, 0, NULL, 0, 0, 0, 0, '2026-05-22T23:59:59Z'),
  ('2026-05-23', 10, 10, 0, 10000, 13988, 3988, 0.3988, 6, 4, 0, 1, '2026-05-23T23:59:59Z'),
  ('2026-05-27', 5, 0, 5, 0, 0, 0, NULL, 0, 0, 0, 0, '2026-05-27T23:59:59Z'),
  ('2026-05-28', 7, 7, 0, 10000, 13031, 3031, 0.3031, 4, 3, 0, 1, '2026-05-28T23:59:59Z'),
  ('2026-05-29', 6, 0, 6, 0, 0, 0, NULL, 0, 0, 0, 0, '2026-05-29T23:59:59Z'),
  ('2026-05-30', 7, 7, 0, 10000, 0, -10000, -1.0, 0, 7, 0, 1, '2026-05-30T23:59:59Z'),
  ('2026-05-31', 7, 7, 0, 10000, 1500, -8500, -0.85, 0, 6, 1, 1, '2026-05-31T23:59:59Z'),
  ('2026-06-01', 7, 6, 1, 7900, 7700, -200, -0.0253, 1, 5, 0, 0, '2026-06-01T23:59:59Z'),
  ('2026-06-02', 5, 5, 0, 8800, 0, -8800, -1.0, 0, 5, 0, 1, '2026-06-02T23:59:59Z'),
  ('2026-06-03', 6, 6, 0, 10000, 21037, 11037, 1.1037, 4, 2, 0, 1, '2026-06-03T23:59:59Z'),
  ('2026-06-04', 6, 6, 0, 10000, 5600, -4400, -0.44, 1, 5, 0, 1, '2026-06-04T23:59:59Z'),
  ('2026-06-05', 7, 6, 1, 8800, 8920, 120, 0.0136, 2, 4, 0, 0, '2026-06-05T23:59:59Z'),
  ('2026-06-06', 7, 7, 0, 10000, 9426, -574, -0.0574, 2, 5, 0, 1, '2026-06-06T23:59:59Z'),
  ('2026-06-07', 6, 6, 0, 10000, 5840, -4160, -0.416, 1, 3, 2, 1, '2026-06-07T23:59:59Z'),
  ('2026-06-08', 8, 7, 1, 9000, 18732, 9732, 1.0813, 3, 3, 1, 0, '2026-06-08T23:59:59Z'),
  ('2026-06-09', 9, 9, 0, 10000, 15782, 5782, 0.5782, 3, 6, 0, 1, '2026-06-09T23:59:59Z'),
  ('2026-06-10', 7, 0, 7, 0, 0, 0, NULL, 0, 0, 0, 0, '2026-06-10T23:59:59Z'),
  ('2026-06-11', 7, 6, 1, 9000, 12625, 3625, 0.4028, 2, 3, 1, 0, '2026-06-11T23:59:59Z'),
  ('2026-06-12', 8, 0, 8, 0, 0, 0, NULL, 0, 0, 0, 0, '2026-06-12T23:59:59Z'),
  ('2026-06-13', 6, 6, 0, 10000, 6300, -3700, -0.37, 1, 5, 0, 1, '2026-06-13T23:59:59Z'),
  ('2026-06-14', 6, 6, 0, 10000, 12825, 2825, 0.2825, 2, 4, 0, 1, '2026-06-14T23:59:59Z'),
  ('2026-06-15', 7, 7, 0, 10000, 13670, 3670, 0.367, 3, 4, 0, 1, '2026-06-15T23:59:59Z'),
  ('2026-06-16', 8, 8, 0, 10000, 23668, 13668, 1.3668, 4, 4, 0, 1, '2026-06-16T23:59:59Z'),
  ('2026-06-17', 7, 7, 0, 10000, 0, -10000, -1.0, 0, 7, 0, 1, '2026-06-17T23:59:59Z'),
  ('2026-06-27', 7, 0, 7, 0, 0, 0, NULL, 0, 0, 0, 0, '2026-06-27T23:59:59Z'),
  ('2026-07-25', 5, 0, 5, 0, 0, 0, NULL, 0, 0, 0, 0, '2026-07-25T23:59:59Z')
ON CONFLICT(date) DO NOTHING;
--> statement-breakpoint
INSERT INTO lessons (
  id, lesson_date, title, observation, evidence, action, status,
  rule_version, source_ref, approved_at
) VALUES
  ('lesson-price-floor', '2026-07-18', 'Price is part of the selection, not an afterthought.', 'A strong horse at a compressed price repeatedly became a poor decision. Every public card now carries fair, minimum and abort prices.', 'Observed odds bands; short-price settled ROI was -29.8%.', 'Fail the publication gate when the executable price crosses its floor.', 'adopted', 'v2', 'agm_analysis_2026_07_18', '2026-08-26T22:00:00Z'),
  ('lesson-medium-confidence', '2026-07-18', 'Medium confidence is doing too much work.', 'The broad 5-7 band contained 108 settled tickets and returned -9.7%, while higher and lower bands were driven by much smaller samples.', 'Confidence-band audit of 129 settled tickets.', 'Split the band by race shape, price quality and evidence depth before changing stakes.', 'watchlist', 'v2', 'agm_analysis_2026_07_18', '2026-08-26T22:00:00Z'),
  ('lesson-no-filler', '2026-07-18', 'Keep multiples subordinate to standalone win cases.', 'A ticket does not exist unless every leg independently clears the win, price and structure gates.', 'Historical Yankee failures and the refined no-filler rule.', 'Publish no ticket instead of manufacturing a fourth leg.', 'adopted', 'v2', 'refined_operating_system_v2', '2026-08-26T22:00:00Z'),
  ('lesson-outlier-sensitivity', '2026-07-18', 'Headline ROI is not robust yet.', 'The corrected settled result is positive, but removing one large winning ticket changes ROI from +3.9% to -2.4%.', 'Outlier sensitivity audit; 129 settled tickets.', 'Show sensitivity beside headline performance until the sample matures.', 'watchlist', 'v2', 'agm_analysis_2026_07_18', '2026-08-26T22:00:00Z'),
  ('lesson-73-opinions', '2026-08-25', 'The 73-opinion historical claims remain hypotheses.', 'The underlying row-level dataset and calculation method were not supplied with the historical summary.', 'Source-stack migration review.', 'Do not display the claims as established trends until reproduced.', 'quarantined', 'v2', 'source_stack_review_2026_08_25', '2026-08-26T22:00:00Z')
ON CONFLICT(id) DO NOTHING;
--> statement-breakpoint
INSERT INTO update_runs (
  id, run_type, started_at, completed_at, status, input_as_of,
  records_accepted, records_rejected, error_summary
) VALUES (
  'historical-import-2026-08-26', 'historical_import', '2026-08-26T22:00:00Z',
  '2026-08-26T22:00:00Z', 'succeeded', '2026-07-25T23:59:59Z', 32, 0,
  'Reconciled settled performance plus approved learning register; unresolved rows retained.'
) ON CONFLICT(id) DO NOTHING;
