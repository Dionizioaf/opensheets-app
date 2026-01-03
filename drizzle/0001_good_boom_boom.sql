ALTER TABLE "lancamentos" DROP CONSTRAINT "lancamentos_antecipacao_id_installment_anticipations_id_fk";
--> statement-breakpoint
CREATE INDEX "lancamentos_duplicate_detection_idx" ON "lancamentos" USING btree ("conta_id","data_compra","valor");--> statement-breakpoint
CREATE INDEX "lancamentos_user_id_idx" ON "lancamentos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lancamentos_period_idx" ON "lancamentos" USING btree ("periodo");--> statement-breakpoint
CREATE INDEX "lancamentos_conta_id_period_idx" ON "lancamentos" USING btree ("conta_id","periodo");